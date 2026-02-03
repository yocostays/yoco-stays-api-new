import mongoose from "mongoose";
import { Request, Response } from "express";
import AnnouncementService from "../services/announcement.service";
import StaffService from "../services/staff.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess, sendError, sendZodError } from "../utils/responseHelpers";
import { isStaffAuthorizedForHostel } from "../utils/lib";
import {
  CreateAnnouncementSchema,
  UpdateAnnouncementSchema,
  GetWardenAnnouncementsSchema,
} from "../utils/validators/announcement.validator";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";

const {
  createAnnouncementHandler,
  updateAnnouncementHandler,
  getAnnouncementsForWardenHandler,
  deleteAnnouncement,
  getAnnouncementById,
} = AnnouncementService;
const { getStaffById } = StaffService;

const { CREATE_DATA, UPDATE_DATA, FETCH_SUCCESS, DELETE_DATA } =
  SUCCESS_MESSAGES;
const { INVALID_ID, REQUIRED_FIELD } = VALIDATION_MESSAGES;
const { RECORD_NOT_FOUND, UNAUTHORIZED_ACCESS } = ERROR_MESSAGES;

class AnnouncementController {
  // SECTION: Controller to create announcement
  createAnnouncement = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const wardenId = req.body?._valid?._id || (req as any).user?.id;

      if (!wardenId || !mongoose.isValidObjectId(wardenId)) {
        return sendError(res, INVALID_ID, 401);
      }

      // Validate input using Zod
      const parseResult = CreateAnnouncementSchema.safeParse(req.body);
      if (!parseResult.success) return sendZodError(res, parseResult) as any;

      const {
        title,
        publishFrom,
        publishTo,
        hostelId,
        activeStudentsOnly,
        isHidden,
        eventName,
        eventTagline,
        startDate,
        endDate,
        startTime,
        endTime,
        venue,
        attachmentLinks,
      } = parseResult.data;

      // Validate staff exists
      const { staff } = await getStaffById(wardenId);
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Check Authorization: Ensure warden is assigned to this hostel
      if (!isStaffAuthorizedForHostel(staff, hostelId)) {
        return sendError(res, UNAUTHORIZED_ACCESS, 403);
      }

      // Parse attachment link if provided (JSON string or object)
      let parsedLink: { url: string; name?: string } | null = null;
      if (attachmentLinks) {
        try {
          const parsed =
            typeof attachmentLinks === "string"
              ? JSON.parse(attachmentLinks)
              : attachmentLinks;
          // If array, take first item; if object, use directly
          parsedLink = Array.isArray(parsed) ? parsed[0] : parsed;
        } catch (e) {
          throw new Error(
            "Invalid format for attachmentLinks. Must be a valid JSON object or string.",
          );
        }
      }

      // Separate image files and attachment file
      const files = req.files as
        | { [fieldname: string]: Express.Multer.File[] }
        | undefined;
      const imageFiles = files?.images || [];
      const attachmentFile = files?.attachment?.[0] || null;

      // Create announcement
      const { announcement } = await createAnnouncementHandler(
        title,
        publishFrom,
        publishTo,
        hostelId,
        wardenId as unknown as mongoose.Types.ObjectId,
        imageFiles,
        eventName,
        eventTagline,
        startDate,
        endDate,
        startTime,
        endTime,
        venue,
        attachmentFile ? [attachmentFile] : undefined,
        parsedLink ? [parsedLink] : undefined,
        activeStudentsOnly,
        isHidden,
      );

      return sendSuccess(res, CREATE_DATA);
    },
  );

  // SECTION: Controller to update announcement
  updateAnnouncement = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const { id } = req.params;
      const wardenId = req.body?._valid?._id || (req as any).user?.id;

      if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
      }

      if (!wardenId || !mongoose.isValidObjectId(wardenId)) {
        return sendError(res, INVALID_ID, 401);
      }

      // Validate input using Zod
      const parseResult = UpdateAnnouncementSchema.safeParse(req.body);
      if (!parseResult.success) return sendZodError(res, parseResult) as any;

      const updateData = parseResult.data;

      // Validate staff exists
      const { staff } = await getStaffById(wardenId);
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Fetch announcement to get its hostelId for authorization
      const announcementRecord = await getAnnouncementById(id);

      // Check Authorization: Ensure warden is assigned to this hostel
      if (
        !isStaffAuthorizedForHostel(
          staff,
          announcementRecord.hostelId.toString(),
        )
      ) {
        return sendError(res, UNAUTHORIZED_ACCESS, 403);
      }

      // Parse attachment link if provided (JSON string or object)
      let parsedLink: { url: string; name?: string } | null = null;
      if (updateData.attachmentLinks) {
        try {
          const parsed =
            typeof updateData.attachmentLinks === "string"
              ? JSON.parse(updateData.attachmentLinks)
              : updateData.attachmentLinks;
          // If array, take first item; if object, use directly
          parsedLink = Array.isArray(parsed) ? parsed[0] : parsed;
        } catch (e) {
          throw new Error(
            "Invalid format for attachmentLinks. Must be a valid JSON object or string.",
          );
        }
      }

      // Get uploaded files if any
      const files = req.files as
        | { [fieldname: string]: Express.Multer.File[] }
        | undefined;
      const imageFiles = files?.images || [];
      const attachmentFile = files?.attachment?.[0] || null;

      // Update announcement
      const { announcement } = await updateAnnouncementHandler(
        id,
        updateData as any,
        wardenId as unknown as mongoose.Types.ObjectId,
        imageFiles,
        attachmentFile ? [attachmentFile] : undefined,
        parsedLink ? [parsedLink] : undefined,
      );

      return sendSuccess(res, UPDATE_DATA);
    },
  );

  // SECTION: Controller to get announcements for warden
  getAnnouncementsForWarden = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const wardenId = req.body?._valid?._id || (req as any).user?.id;

      if (!wardenId || !mongoose.isValidObjectId(wardenId)) {
        return sendError(res, INVALID_ID, 401);
      }

      // Validate using Zod
      const parseResult = GetWardenAnnouncementsSchema.safeParse(req.body);

      if (!parseResult.success) {
        return sendZodError(res, parseResult) as any;
      }

      const { hostelId, filters, page, limit } = parseResult.data;
      const { status, isHidden, fromDate, toDate } = filters || {};

      // Validate staff exists
      const { staff } = await getStaffById(wardenId);
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Check Authorization: Ensure warden is assigned to this hostel
      if (!isStaffAuthorizedForHostel(staff, hostelId)) {
        return sendError(res, UNAUTHORIZED_ACCESS, 403);
      }

      const result = await getAnnouncementsForWardenHandler(
        hostelId,
        status as any,
        isHidden,
        fromDate,
        toDate,
        page,
        limit,
      );

      return sendSuccess(res, FETCH_SUCCESS, result);
    },
  );

  // SECTION: Controller to delete announcement
  deleteAnnouncement = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const { id } = req.params;
      const deletedById = req.body?._valid?._id || (req as any).user?.id;

      if (!mongoose.isValidObjectId(id)) {
        return sendError(res, INVALID_ID, 400);
      }

      if (!deletedById || !mongoose.isValidObjectId(deletedById)) {
        return sendError(res, INVALID_ID, 401);
      }

      // Validate staff exists (optional but good for audit)
      const { staff } = await getStaffById(deletedById);
      if (!staff) throw new Error(RECORD_NOT_FOUND("Staff"));

      // Fetch announcement to get its hostelId for authorization
      const announcementRecord = await getAnnouncementById(id);

      // Check Authorization: Ensure warden is assigned to this hostel
      if (
        !isStaffAuthorizedForHostel(
          staff,
          announcementRecord.hostelId.toString(),
        )
      ) {
        return sendError(res, UNAUTHORIZED_ACCESS, 403);
      }

      await deleteAnnouncement(
        id,
        deletedById as unknown as mongoose.Types.ObjectId,
      );

      return sendSuccess(res, DELETE_DATA);
    },
  );
}

export default new AnnouncementController();
