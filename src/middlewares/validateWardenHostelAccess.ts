import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/responseHelpers";
import { ERROR_MESSAGES } from "../utils/messages";
import { AccountType } from "../utils/enum";
import Hostel from "../models/hostel.model";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";

const { UNAUTHORIZED_ACCESS, REQUIRED_FIELD } = ERROR_MESSAGES;

export const validateWardenHostelAccess = asyncHandler(
  async (
    req: Request,
    res: Response,
    next?: NextFunction
  ): Promise<void | Response> => {
    const wardenId = req.body._valid?._id;
    const userType = req.body._valid?.userType;

    if (!wardenId) {
      return sendError(res, UNAUTHORIZED_ACCESS, 401);
    }

    if (userType !== AccountType.STAFF) {
      return sendError(res, "Access denied. Staff access required", 403);
    }

    const { hostelId } = req.body;
    if (!hostelId) {
      return sendError(res, REQUIRED_FIELD("hostelId"));
    }

    if (!mongoose.Types.ObjectId.isValid(hostelId)) {
      return sendError(res, "Invalid hostel ID format", 400);
    }
    const hostel = await Hostel.findById(hostelId).select("wardenIds");
    if (!hostel) {
      return sendError(res, "Hostel not found", 404);
    }

    const isAssigned = hostel.wardenIds.some(
      (id) => id.toString() === wardenId.toString()
    );

    if (!isAssigned) {
      return sendError(
        res,
        "Access denied. You are not assigned as warden to this hostel",
        403
      );
    }

    if (next) next();
  }
);
