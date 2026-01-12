import { Request, Response, NextFunction } from "express";
import User from "../models/user.model";
import { sendError } from "../utils/responseHelpers";
import { AccountType } from "../utils/enum";
import { ERROR_MESSAGES, VALIDATION_MESSAGES } from "../utils/messages";

//Middleware to check if the authenticated student is active.

export const checkActiveStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validUser = req.body._valid;

    if (!validUser || !validUser._id) {
      return sendError(res, ERROR_MESSAGES.UNAUTHORIZED_ACCESS, 401);
    }

    if (validUser.userType === AccountType.STUDENT) {
      const student = await User.findById(validUser._id)
        .select("status")
        .lean();

      if (!student) {
        return sendError(res, ERROR_MESSAGES.RECORD_NOT_FOUND("Student"), 404);
      }

      if (!student.status) {
        return sendError(res, ERROR_MESSAGES.USER_NOT_ACTIVE, 403);
      }
    }

    next();
  } catch (error) {
    console.error("Error in checkActiveStudent middleware:", error);
    return sendError(res, ERROR_MESSAGES.SERVER_ERROR, 500);
  }
};
