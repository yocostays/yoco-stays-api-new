import mongoose from "mongoose";
import { Request, Response } from "express";
import UserService from "../services/user.service";
import User from "../models/user.model";
import DashboardService from "../services/dashboard.service";
import AnnouncementService from "../services/announcement.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess, sendError } from "../utils/responseHelpers";
import { HttpResponse } from "../utils/httpResponse";
import {
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  VALIDATION_MESSAGES,
} from "../utils/messages";

const { getStudentById } = UserService;
const { wardenDashboardData, userDashboardData } = DashboardService;
const { getAnnouncementsForStudent } = AnnouncementService;

const { FETCH_SUCCESS } = SUCCESS_MESSAGES;
const { SERVER_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;
const { INVALID_ID, REQUIRED_FIELD } = VALIDATION_MESSAGES;

class DahboardController {
  //SECTION Controller method to get warden Dashboard Details
  async wardenDashboardDetails(
    req: Request,
    res: Response,
  ): Promise<Response<HttpResponse>> {
    try {
      const createdById = req.body._valid._id;

      if (!mongoose.isValidObjectId(createdById)) {
        throw new Error(INVALID_ID);
      }

      const { hostelId } = req.body;

      // Call the service to create a new user
      const { result } = await wardenDashboardData(hostelId, createdById);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: result,
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

  //SECTION Controller method to get user Dashboard Details
  async userDashboardDetails(
    req: Request,
    res: Response,
  ): Promise<Response<HttpResponse>> {
    try {
      const userId = req.body._valid._id;

      if (!mongoose.isValidObjectId(userId)) throw new Error(INVALID_ID);

      // Call the service to retrieve student
      const { student } = await getStudentById(userId);

      if (!student) throw new Error(RECORD_NOT_FOUND("Student"));

      // Call the service to count
      const { result } = await userDashboardData(userId);

      const successResponse: HttpResponse = {
        statusCode: 200,
        message: FETCH_SUCCESS,
        data: result,
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

  // SECTION: Controller to get announcements for student
  getAnnouncementsForStudentDashboard = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const studentId = (req as any).user?.id || req.body?._valid?._id;

      if (!studentId || !mongoose.isValidObjectId(studentId)) {
        return sendError(res, INVALID_ID, 401);
      }

      // Fetch student to get their hostelId
      const student = await User.findById(studentId).select("hostelId").lean();
      if (!student) {
        return sendError(res, RECORD_NOT_FOUND("Student"), 404);
      }

      if (!student.hostelId) {
        return sendError(res, "No hostel assigned to this student", 400);
      }

      const { announcements } = await getAnnouncementsForStudent(
        studentId as unknown as mongoose.Types.ObjectId,
        student.hostelId as unknown as mongoose.Types.ObjectId,
      );

      return sendSuccess(res, FETCH_SUCCESS, { announcements });
    },
  );
}

export default new DahboardController();
