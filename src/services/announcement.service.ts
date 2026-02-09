import mongoose from "mongoose";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import Announcement from "../models/announcement.model";
import User from "../models/user.model";
import Notice from "../models/notice.model";
import UserService from "./user.service";
import TemplateService from "./template.service";
import {
  uploadFileToCloudStorage,
  deleteFromS3,
  getSignedUrl,
} from "../utils/awsUploadService";
import {
  AnnouncementStatus,
  EventStatus,
  NoticeTypes,
  PushNotificationTypes,
  TemplateTypes,
} from "../utils/enum";
import { ERROR_MESSAGES } from "../utils/messages";
import { paginateAggregate } from "../utils/pagination";
import { AppError } from "../utils/errors";
import { sendPushNotificationToUser } from "../utils/commonService/pushNotificationService";
import { getCurrentISTTime } from "../utils/lib";

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
  createAnnouncementHandler = async (
    title: string,
    publishFrom: string,
    publishTo: string,
    hostelId: string,
    createdById: mongoose.Types.ObjectId,
    imageFiles: Express.Multer.File[],
    eventName?: string | null,
    eventTagline?: string | null,
    startDate?: string | null,
    endDate?: string | null,
    startTime?: string | null,
    endTime?: string | null,
    venue?: string | null,
    attachmentFiles?: Express.Multer.File[],
    attachmentLinks?: Array<{ url: string; name?: string }>,
    activeStudentsOnly: boolean = false,
    isHidden: boolean = false,
  ): Promise<{ announcement: any }> => {
    const uploadedKeys: string[] = [];

    try {
      // Validate minimum 1 image
      if (!imageFiles || imageFiles.length < 1) {
        throw new AppError("At least 1 image is required", 400);
      }

      if (imageFiles.length > 5) {
        throw new Error("Maximum 5 images allowed");
      }

      // Validate image sizes (Max 2MB per image)
      for (const file of imageFiles) {
        if (file.size > 2 * 1024 * 1024) {
          throw new AppError(`Image size exceeds, required less than 2MB`, 400);
        }
      }

      // Parallel Image Uploads
      const imageUploadPromises = imageFiles.map((file) =>
        uploadFileToCloudStorage(file, `ann/${hostelId}`),
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
          `ann/${hostelId}/att`,
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
        startDate: startDate || null,
        endDate: endDate || null,
        startTime: startTime || null,
        endTime: endTime || null,
        venue: venue || null,
        hostelId: new mongoose.Types.ObjectId(hostelId),
        activeStudentsOnly,
        isHidden,
        eventStatus: EventStatus.ACTIVE,
        createdBy: createdById,
      });

      if (!isHidden) {
        this.notifyStudents(
          hostelId,
          TemplateTypes.ANNOUNCEMENT_CREATED,
          activeStudentsOnly,
        ).catch((err) =>
          console.error("Announcement Create Notif Error:", err),
        );
      }

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
  };

  // Update announcement
  updateAnnouncementHandler = async (
    announcementId: string,
    updateData: {
      title?: string;
      eventName?: string | null;
      eventTagline?: string | null;
      publishFrom?: string;
      publishTo?: string;
      startDate?: string | null;
      endDate?: string | null;
      startTime?: string | null;
      endTime?: string | null;
      venue?: string | null;
      isHidden?: boolean;
      eventStatus?: EventStatus;
      activeStudentsOnly?: boolean;
    },
    updatedById: mongoose.Types.ObjectId,
    imageFiles?: Express.Multer.File[],
    attachmentFiles?: Express.Multer.File[],
    attachmentLinks?: Array<{ url: string; name?: string }>,
  ): Promise<{ announcement: any }> => {
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
      if (updateData.eventName !== undefined)
        updateFields.eventName = updateData.eventName;
      if (updateData.eventTagline !== undefined)
        updateFields.eventTagline = updateData.eventTagline;
      if (updateData.startDate !== undefined)
        updateFields.startDate = updateData.startDate;
      if (updateData.endDate !== undefined)
        updateFields.endDate = updateData.endDate;
      if (updateData.startTime !== undefined)
        updateFields.startTime = updateData.startTime;
      if (updateData.endTime !== undefined)
        updateFields.endTime = updateData.endTime;
      if (updateData.venue !== undefined) updateFields.venue = updateData.venue;
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

        // Validate image sizes (Max 2MB per image)
        for (const file of imageFiles) {
          if (file.size > 2 * 1024 * 1024) {
            throw new AppError(
              `Image ${file.originalname} exceeds the 2MB size limit`,
              400,
            );
          }
        }

        // Parallel Image Uploads
        const imageUploadPromises = imageFiles.map((file) =>
          uploadFileToCloudStorage(file, `ann/${announcement.hostelId}`),
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
          `ann/${announcement.hostelId}/att`,
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

      // Trigger Notification (Async, don't block response)
      // Note: We notify on update if it's currently published (not hidden)
      if (updated && !updated.isHidden) {
        this.notifyStudents(
          updated.hostelId.toString(),
          TemplateTypes.ANNOUNCEMENT_UPDATED,
          updated.activeStudentsOnly,
        ).catch((err) =>
          console.error("Announcement Update Notif Error:", err),
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
  };

  // Get announcements for warden with status filter
  getAnnouncementsForWardenHandler = async (
    hostelId: string,
    status?: AnnouncementStatus,
    isHidden?: boolean,
    fromDate?: string,
    toDate?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    announcements: any[];
    totalCount: number;
    startIndex: number;
    endIndex: number;
    currentPage: number;
    totalPages: number;
  }> => {
    const today = dayjs().utc().startOf("day").toDate();

    const pipeline: any[] = [
      {
        $match: {
          hostelId: new mongoose.Types.ObjectId(hostelId),
        },
      },
    ];

    // Filter by isHidden if provided
    if (isHidden !== undefined) {
      pipeline.push({
        $match: { isHidden: isHidden },
      });
    }

    // Filter by date range (on publishFrom) if provided
    if (fromDate || toDate) {
      const dateFilter: any = {};
      if (fromDate) {
        dateFilter.$gte = dayjs.utc(fromDate).startOf("day").toDate();
      }
      if (toDate) {
        dateFilter.$lte = dayjs.utc(toDate).endOf("day").toDate();
      }
      pipeline.push({
        $match: { publishFrom: dateFilter },
      });
    }

    pipeline.push({
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
    });

    // Filter by computed status if provided
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

    // Map through data to sign URLs
    const signedAnnouncements = await Promise.all(
      data.map(async (announcement: any) => {
        const signedImages = announcement.images
          ? await Promise.all(
              announcement.images.map(
                async (img: string) => (await getSignedUrl(img)) || "",
              ),
            )
          : [];

        let signedAttachment = announcement.attachment;
        if (
          announcement.attachment &&
          announcement.attachment.type === "FILE" &&
          announcement.attachment.url
        ) {
          signedAttachment = {
            ...announcement.attachment,
            url: (await getSignedUrl(announcement.attachment.url)) || "",
          };
        }

        return {
          ...announcement,
          images: signedImages,
          attachment: signedAttachment,
        };
      }),
    );

    return {
      announcements: signedAnnouncements,
      totalCount: count,
      startIndex: startIndex + 1,
      endIndex: Math.min(endIndex, count),
      currentPage: page,
      totalPages,
    };
  };

  // Delete announcement
  deleteAnnouncement = async (
    announcementId: string,
    deletedById: mongoose.Types.ObjectId,
  ): Promise<void> => {
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
  };

  // Get announcement by id
  getAnnouncementById = async (id: string): Promise<any> => {
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      throw new Error(RECORD_NOT_FOUND("Announcement"));
    }
    return announcement;
  };

  // //----------------------student methods----------------------------

  // Get announcements for student dashboard
  getAnnouncementsForStudent = async (
    userId: mongoose.Types.ObjectId,
    hostelId: mongoose.Types.ObjectId,
  ): Promise<{ announcements: any[] }> => {
    // Get student details
    const student = await User.findById(userId).select("status").lean();
    if (!student) {
      throw new Error(RECORD_NOT_FOUND("Student"));
    }

    const today = dayjs().utc().startOf("day").toDate();

    const query: any = {
      hostelId,
      isHidden: false,
      publishFrom: { $lte: today },
      publishTo: { $gte: today },
    };

    if (!student.status) {
      query.activeStudentsOnly = false;
    }

    // Fetch announcements for the hostel that are currently published and not hidden
    const announcements = await Announcement.find(query)
      .sort({ publishFrom: -1 })
      .lean();
    // Map through data to sign URLs
    const signedAnnouncements = await Promise.all(
      announcements.map(async (announcement: any) => {
        // Compute status for display
        const status = AnnouncementService.computeAnnouncementStatus(
          announcement.publishFrom as Date,
          announcement.publishTo as Date,
        );

        const signedImages = announcement.images
          ? await Promise.all(
              announcement.images.map(
                async (img: string) => (await getSignedUrl(img)) || "",
              ),
            )
          : [];

        let signedAttachment = announcement.attachment;
        if (
          announcement.attachment &&
          announcement.attachment.type === "FILE" &&
          announcement.attachment.url
        ) {
          signedAttachment = {
            ...announcement.attachment,
            url: (await getSignedUrl(announcement.attachment.url)) || "",
          };
        }

        return {
          ...announcement,
          status,
          images: signedImages,
          attachment: signedAttachment,
        };
      }),
    );

    return { announcements: signedAnnouncements };
  };

  // Notify students about new or updated announcement
  private notifyStudents = async (
    hostelId: string,
    templateType: TemplateTypes,
    activeStudentsOnly: boolean = false,
  ): Promise<void> => {
    try {
      // Fetch template once for the hostel
      const { template } = await TemplateService.checkTemplateExist(
        hostelId,
        templateType,
      );

      if (!template) {
        return;
      }

      // Fetch eligible students with their allocation details in one go
      const userQuery: any = {
        hostelId: new mongoose.Types.ObjectId(hostelId),
        isLeft: false,
      };
      if (activeStudentsOnly) {
        userQuery.isVerified = true;
      }

      // We use aggregation to get both user details and their current allocation
      const studentData = await User.aggregate([
        { $match: userQuery },
        {
          $lookup: {
            from: "studenthostelallocations",
            let: { userId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$studentId", "$$userId"] },
                      {
                        $eq: [
                          "$hostelId",
                          new mongoose.Types.ObjectId(hostelId),
                        ],
                      },
                    ],
                  },
                },
              },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: "allocation",
          },
        },
        { $unwind: { path: "$allocation", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            oneSignalWebId: 1,
            oneSignalAndoridId: 1,
            oneSignalIosId: 1,
            "allocation.floorNumber": 1,
            "allocation.bedType": 1,
            "allocation.roomNumber": 1,
          },
        },
      ]);

      if (studentData.length === 0) {
        return;
      }

      const noticesToCreate: any[] = [];
      const allPlayerIds: string[] = [];
      const currentTime = getCurrentISTTime();

      // Prepare bulk data
      for (const student of studentData) {
        // Collect player IDs
        if (student.oneSignalWebId) allPlayerIds.push(student.oneSignalWebId);
        if (student.oneSignalAndoridId)
          allPlayerIds.push(student.oneSignalAndoridId);
        if (student.oneSignalIosId) allPlayerIds.push(student.oneSignalIosId);

        // Prepare Notice record
        noticesToCreate.push({
          userId: student._id,
          hostelId: new mongoose.Types.ObjectId(hostelId),
          floorNumber: student.allocation?.floorNumber || 0,
          bedType: student.allocation?.bedType || null,
          roomNumber: student.allocation?.roomNumber || 0,
          noticeTypes: NoticeTypes.PUSH_NOTIFICATION,
          pushNotificationTypes: PushNotificationTypes.AUTO,
          templateId: template._id,
          templateSendMessage: template.description || template.body,
          isNoticeCreated: true,
          createdAt: currentTime,
        });
      }

      // Bulk Create Notices
      if (noticesToCreate.length > 0) {
        await Notice.insertMany(noticesToCreate, { ordered: false }).catch(
          (err) => console.error("Bulk Notice Create Error:", err),
        );
      }

      // Send Batch Push Notification (Deduplicated inside sendPushNotificationToUser)
      if (allPlayerIds.length > 0) {
        // Deduplicate and filter empty IDs before sending
        const uniqueIds = Array.from(new Set(allPlayerIds));

        // OneSignal has a limit of 2000 IDs per request for include_player_ids
        for (let i = 0; i < uniqueIds.length; i += 2000) {
          const chunk = uniqueIds.slice(i, i + 2000);
          sendPushNotificationToUser(
            chunk,
            template.title || template.heading || "Announcement",
            template.description || template.body,
            templateType,
          ).catch((err) =>
            console.error("Announcement Batch Push Error:", err),
          );
        }
      }
    } catch (error: any) {
      console.error(
        `[Announcement Batch Notif Error] Hostel ${hostelId}:`,
        error.message,
      );
    }
  };
}

export default new AnnouncementService();
