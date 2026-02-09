import mongoose from "mongoose";
import { Request, Response } from "express";
import NoticeService from "../services/notice.service";
import StaffService from "../services/staff.service";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
} from "../utils/messages";
import { NoticeTypes } from "../utils/enum";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess, sendError } from "../utils/responseHelpers";

const {
  createNotice,
  getAllNotice,
  getUserNotifications,
  markNotificationsAsRead,
} = NoticeService;

const { getStaffExistById } = StaffService;

const { CREATE_DATA, FETCH_SUCCESS } = SUCCESS_MESSAGES;
const { REQUIRED_FIELD, INVALID_ID } = VALIDATION_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;

class NoticeController {
  //SECTION: Controller send notification to multiple user and create new notice.
  async createNotice(
    req: Request,
    res: Response,
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid?._id;
      const { userIds, templateId, noticeType } = req.body;

      if (createdById && !mongoose.isValidObjectId(createdById))
        throw new Error(INVALID_ID);

      if (createdById) {
        // Call the service to retrieve staff
        const { exists } = await getStaffExistById(createdById);
        if (!exists) throw new Error(RECORD_NOT_FOUND("Staff"));
      }

      await createNotice(userIds, noticeType, templateId);
      const successResponse: HttpResponse = {
        statusCode: 200,
        message: CREATE_DATA,
      };
      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION: Controller to get all notice.
  async getAllNotice(
    req: Request,
    res: Response,
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid?._id;
      const {
        page,
        limit,
        search,
        hostelId,
        floorNumber,
        roomNumber,
        noticeType,
        sort,
      } = req.body;

      if (createdById && !mongoose.isValidObjectId(createdById))
        throw new Error(INVALID_ID);

      if (createdById) {
        // Call the service to retrieve staff
        const { exists } = await getStaffExistById(createdById);
        if (!exists) throw new Error(RECORD_NOT_FOUND("Staff"));
      }
      // Convert page and limit to integers
      const parsedPage = parseInt(page as string);
      const parsedLimit = parseInt(limit as string);
      const paredFloorNumber = parseInt(floorNumber as string);
      const paredRoomNumber = parseInt(roomNumber as string);

      const { notices, count } = await getAllNotice(
        parsedPage,
        parsedLimit,
        search as string,
        hostelId as string,
        paredFloorNumber,
        paredRoomNumber,
        noticeType as NoticeTypes,
        sort as string,
      );
      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        count,
        data: notices,
      };
      return res.status(200).json(successResponse);
    } catch (error: any) {
      const errorMessage = error.message ?? SERVER_ERROR;
      const errorResponse: HttpResponse = {
        statusCode: 400,
        message: errorMessage,
      };
      return res.status(400).json(errorResponse);
    }
  }

  //SECTION: Get user notifications
  getUserNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.body._valid?._id;
    if (!userId) return sendError(res, ERROR_MESSAGES.UNAUTHORIZED_ACCESS);

    const { items, unreadCount } = await getUserNotifications(userId);

    return sendSuccess(res, FETCH_SUCCESS, { items, unreadCount });
  });

  //SECTION: Mark all notifications as read
  markNotificationsAsRead = asyncHandler(
    async (req: Request, res: Response) => {
      const userId = req.body._valid?._id;
      if (!userId) return sendError(res, ERROR_MESSAGES.UNAUTHORIZED_ACCESS);

      await markNotificationsAsRead(userId);

      return sendSuccess(res, "Notifications marked as read");
    },
  );
}

export default new NoticeController();
