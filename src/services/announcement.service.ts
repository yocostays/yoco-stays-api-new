import mongoose from "mongoose";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import Announcement from "../models/announcement.model";
import User from "../models/user.model";
import {
  uploadFileToCloudStorage,
  deleteFromS3,
} from "../utils/awsUploadService";
import { AnnouncementStatus, EventStatus } from "../utils/enum";
import { ERROR_MESSAGES } from "../utils/messages";
import { paginateAggregate } from "../utils/pagination";
import { AppError } from "../utils/errors";

dayjs.extend(utc);

const { RECORD_NOT_FOUND } = ERROR_MESSAGES;

class AnnouncementService {
  // Helper function to compute announcement status
  static computeAnnouncementStatus(
    publishFrom: Date,
    publishTo: Date,
  ): AnnouncementStatus {
    const today = dayjs().startOf("day");
    const from = dayjs(publishFrom).startOf("day");
    const to = dayjs(publishTo).startOf("day");

    if (today.isBefore(from)) return AnnouncementStatus.UPCOMING;
    if (today.isAfter(to)) return AnnouncementStatus.PAST;
    return AnnouncementStatus.CURRENT;
  }

  // Helper function to normalize dates to UTC midnight
  static normalizeDateToUTC(dateString: string): Date {
    return dayjs.utc(dateString).startOf("day").toDate();
  }

  // Helper to generate sequential ID like E01, E02
  static async generateNextAnnouncementId(): Promise<string> {
    const lastAnnouncement = await Announcement.findOne().sort({
      createdAt: -1,
    });
    let nextNumber = 1;
    if (lastAnnouncement && lastAnnouncement.announcementId) {
      const match = lastAnnouncement.announcementId.match(/E(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    return `E${nextNumber.toString().padStart(2, "0")}`;
  }

  // Create announcement
  async createAnnouncementHandler(
    title: string,
    publishFrom: string,
    publishTo: string,
    hostelId: string,
    createdById: mongoose.Types.ObjectId,
    imageFiles: Express.Multer.File[],
    eventName?: string,
    eventTagline?: string,
    date?: string,
    time?: string,
    venue?: string,
    attachmentFiles?: Express.Multer.File[],
    attachmentLinks?: Array<{ url: string; name?: string }>,
    activeStudentsOnly: boolean = false,
    isHidden: boolean = false,
  ): Promise<{ announcement: any }> {
    const uploadedKeys: string[] = [];

    try {
      // Validate minimum 1 image
      if (!imageFiles || imageFiles.length < 1) {
        throw new AppError("At least 1 image is required", 400);
      }

      if (imageFiles.length > 5) {
        throw new Error("Maximum 5 images allowed");
      }

      // Parallel Image Uploads
      const imageUploadPromises = imageFiles.map((file) =>
        uploadFileToCloudStorage(file, `announcements/${hostelId}`),
      );

      const imageResults = await Promise.all(imageUploadPromises);
      const imageUrls: string[] = [];

      imageResults.forEach((result) => {
        if (result && result.Key) {
          imageUrls.push(result.Key);
          uploadedKeys.push(result.Key);
        }
      });

      if (imageUrls.length === 0) {
        throw new Error("Failed to upload images");
      }

      // Process Attachment (File or Link)
      let attachment: any = null;

      if (attachmentFiles?.length && attachmentLinks?.length) {
        throw new Error("Only one attachment type (File or Link) is allowed");
      }

      // Upload Attachment File if present
      if (attachmentFiles && attachmentFiles.length > 0) {
        const file = attachmentFiles[0];
        const uploadResult = await uploadFileToCloudStorage(
          file,
          `announcements/${hostelId}/attachments`,
        );

        if (uploadResult && uploadResult.Key) {
          uploadedKeys.push(uploadResult.Key);
          attachment = {
            type: "FILE",
            url: uploadResult.Key,
            name: file.originalname,
          };
        }
      } else if (attachmentLinks && attachmentLinks.length > 0) {
        const link = attachmentLinks[0];
        attachment = {
          type: "LINK",
          url: link.url,
          name: link.name || link.url,
        };
      }

      //Create Database Record
      const announcementId =
        await AnnouncementService.generateNextAnnouncementId();

      const announcement = await Announcement.create({
        announcementId,
        title,
        eventName: eventName || null,
        eventTagline: eventTagline || null,
        images: imageUrls,
        attachment,
        publishFrom: AnnouncementService.normalizeDateToUTC(publishFrom),
        publishTo: AnnouncementService.normalizeDateToUTC(publishTo),
        date: date || null,
        time: time || null,
        venue: venue || null,
        hostelId: new mongoose.Types.ObjectId(hostelId),
        activeStudentsOnly,
        isHidden,
        eventStatus: EventStatus.ACTIVE,
        createdBy: createdById,
      });

      return { announcement };
    } catch (error) {
      // Rollback: Delete uploaded files if DB creation fails
      if (uploadedKeys.length > 0) {
        await Promise.all(
          uploadedKeys.map((key) => deleteFromS3("local-dev-bucket", key)),
        );
      }
      throw error;
    }
  }

  // Update announcement
  async updateAnnouncementHandler(
    announcementId: string,
    updateData: {
      title?: string;
      eventName?: string;
      eventTagline?: string;
      publishFrom?: string;
      publishTo?: string;
      date?: string;
      time?: string;
      venue?: string;
      isHidden?: boolean;
      eventStatus?: EventStatus;
      activeStudentsOnly?: boolean;
    },
    updatedById: mongoose.Types.ObjectId,
    imageFiles?: Express.Multer.File[],
    attachmentFiles?: Express.Multer.File[],
    attachmentLinks?: Array<{ url: string; name?: string }>,
  ): Promise<{ announcement: any }> {
    const uploadedKeys: string[] = [];
    const keysToDelete: string[] = [];

    try {
      // Find existing announcement
      const announcement = await Announcement.findById(announcementId);
      if (!announcement) {
        throw new Error(RECORD_NOT_FOUND("Announcement"));
      }

      // Prepare update object
      const updateFields: Record<string, any> = {
        updatedBy: updatedById,
      };

      // Update fields if provided
      if (updateData.title) updateFields.title = updateData.title;
      if (updateData.eventName) updateFields.eventName = updateData.eventName;
      if (updateData.eventTagline)
        updateFields.eventTagline = updateData.eventTagline;
      if (updateData.date) updateFields.date = updateData.date;
      if (updateData.time) updateFields.time = updateData.time;
      if (updateData.venue) updateFields.venue = updateData.venue;
      if (updateData.isHidden !== undefined)
        updateFields.isHidden = updateData.isHidden;
      if (updateData.eventStatus)
        updateFields.eventStatus = updateData.eventStatus;
      if (updateData.activeStudentsOnly !== undefined)
        updateFields.activeStudentsOnly = updateData.activeStudentsOnly;

      // Update publish dates if provided
      if (updateData.publishFrom) {
        updateFields.publishFrom = AnnouncementService.normalizeDateToUTC(
          updateData.publishFrom,
        );
      }
      if (updateData.publishTo) {
        updateFields.publishTo = AnnouncementService.normalizeDateToUTC(
          updateData.publishTo,
        );
      }

      // Handle image replacement if new images provided
      if (imageFiles && imageFiles.length > 0) {
        if (imageFiles.length > 5) {
          throw new Error("Maximum 5 images allowed");
        }

        // Parallel Image Uploads
        const imageUploadPromises = imageFiles.map((file) =>
          uploadFileToCloudStorage(
            file,
            `announcements/${announcement.hostelId}`,
          ),
        );

        const imageResults = await Promise.all(imageUploadPromises);
        const imageUrls: string[] = [];

        imageResults.forEach((result) => {
          if (result && result.Key) {
            imageUrls.push(result.Key);
            uploadedKeys.push(result.Key);
          }
        });

        if (imageUrls.length > 0) {
          updateFields.images = imageUrls;
          // Track old images for deletion
          if (announcement.images && announcement.images.length > 0) {
            keysToDelete.push(...announcement.images);
          }
        }
      }

      // Handle Attachment Update
      if (attachmentFiles?.length && attachmentLinks?.length) {
        throw new Error("Only one attachment type (File or Link) is allowed");
      }

      // Process file attachment
      if (attachmentFiles && attachmentFiles.length > 0) {
        const file = attachmentFiles[0];
        const uploadResult = await uploadFileToCloudStorage(
          file,
          `announcements/${announcement.hostelId}/attachments`,
        );

        if (uploadResult && uploadResult.Key) {
          uploadedKeys.push(uploadResult.Key);
          updateFields.attachment = {
            type: "FILE",
            url: uploadResult.Key,
            name: file.originalname,
          };

          // Track old attachment for deletion if it was a file
          if (
            announcement.attachment &&
            announcement.attachment.type === "FILE" &&
            announcement.attachment.url
          ) {
            keysToDelete.push(announcement.attachment.url);
          }
        }
      } else if (attachmentLinks && attachmentLinks.length > 0) {
        // Process link attachment
        const link = attachmentLinks[0];
        updateFields.attachment = {
          type: "LINK",
          url: link.url,
          name: link.name || link.url,
        };

        // Track old attachment for deletion if it was a file
        if (
          announcement.attachment &&
          announcement.attachment.type === "FILE" &&
          announcement.attachment.url
        ) {
          keysToDelete.push(announcement.attachment.url);
        }
      }

      // Validate that there is something to update besides updatedBy
      if (Object.keys(updateFields).length <= 1) {
        throw new Error("No fields provided for update");
      }

      // Update announcement
      const updated = await Announcement.findByIdAndUpdate(
        announcementId,
        updateFields,
        { new: true },
      );

      // Cleanup old files after successful update
      if (keysToDelete.length > 0) {
        await Promise.all(
          keysToDelete.map((key) => deleteFromS3("local-dev-bucket", key)),
        );
      }

      return { announcement: updated };
    } catch (error) {
      // Rollback: Delete newly uploaded files if DB update fails
      if (uploadedKeys.length > 0) {
        await Promise.all(
          uploadedKeys.map((key) => deleteFromS3("local-dev-bucket", key)),
        );
      }
      throw error;
    }
  }

  // Get announcements for warden with status filter
  async getAnnouncementsForWardenHandler(
    hostelId: string,
    status?: AnnouncementStatus,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    announcements: any[];
    totalCount: number;
    startIndex: number;
    endIndex: number;
    currentPage: number;
    totalPages: number;
  }> {
    const today = dayjs().utc().startOf("day").toDate();

    const pipeline: any[] = [
      {
        $match: {
          hostelId: new mongoose.Types.ObjectId(hostelId),
        },
      },
      {
        $addFields: {
          status: {
            $switch: {
              branches: [
                {
                  case: { $lt: [today, "$publishFrom"] },
                  then: AnnouncementStatus.UPCOMING,
                },
                {
                  case: { $gt: [today, "$publishTo"] },
                  then: AnnouncementStatus.PAST,
                },
              ],
              default: AnnouncementStatus.CURRENT,
            },
          },
        },
      },
    ];

    // Filter by status if provided
    if (status) {
      pipeline.push({
        $match: {
          status: status,
        },
      });
    }

    // Sort by latest created
    pipeline.push({
      $sort: { createdAt: -1 },
    });

    const { data, count } = await paginateAggregate(
      Announcement,
      pipeline,
      page,
      limit,
    );

    const totalPages = Math.ceil(count / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    return {
      announcements: data,
      totalCount: count,
      startIndex: startIndex + 1,
      endIndex: Math.min(endIndex, count),
      currentPage: page,
      totalPages,
    };
  }

  // Delete announcement
  async deleteAnnouncement(
    announcementId: string,
    deletedById: mongoose.Types.ObjectId,
  ): Promise<void> {
    const announcement = await Announcement.findById(announcementId);
    if (!announcement) {
      throw new Error(RECORD_NOT_FOUND("Announcement"));
    }

    // Check if PAST
    const status = AnnouncementService.computeAnnouncementStatus(
      announcement.publishFrom as Date,
      announcement.publishTo as Date,
    );

    if (status === AnnouncementStatus.PAST) {
      throw new Error("Cannot delete PAST announcements");
    }

    // Delete images from S3
    if (announcement.images && announcement.images.length > 0) {
      for (const imageKey of announcement.images) {
        await deleteFromS3("local-dev-bucket", imageKey);
      }
    }

    // Delete attachment from S3 (if file)
    if (
      announcement.attachment &&
      announcement.attachment.type === "FILE" &&
      announcement.attachment.url
    ) {
      await deleteFromS3("local-dev-bucket", announcement.attachment.url);
    }

    // Delete from DB
    await Announcement.findByIdAndDelete(announcementId);
  }

  // Get announcement by id
  async getAnnouncementById(id: string): Promise<any> {
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      throw new Error(RECORD_NOT_FOUND("Announcement"));
    }
    return announcement;
  }
}

export default new AnnouncementService();
