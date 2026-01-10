import { Request, Response } from "express";
import QRService from "../services/qr.service";
import { sendSuccess } from "../utils/responseHelpers";
import { SUCCESS_MESSAGES, VALIDATION_MESSAGES } from "../utils/messages";
import { asyncHandler } from "../utils/asyncHandler";
import User from "../models/user.model";
import { BadRequestError } from "../utils/errors";
import { ERROR_MESSAGES } from "../utils/messages";

const { QR_GENERATED_SUCCESSFULLY, FETCH_SUCCESS } = SUCCESS_MESSAGES;
const { REQUIRED_FIELD, INVALID_ID } = VALIDATION_MESSAGES;
const { RECORD_NOT_FOUND } = ERROR_MESSAGES;

// Access authenticated user structure safely
interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    id: string;
    userType: string;
    [key: string]: any;
  };
}

class QRController {
  // Get currently active QR without rotation
  getActiveQR = asyncHandler(async (req: Request, res: Response) => {
    const { hostelId } = req.body;

    if (!hostelId) {
      throw new BadRequestError(REQUIRED_FIELD("Hostel ID"));
    }

    const qrMap = await QRService.getActiveQR(hostelId);
    return sendSuccess(res, FETCH_SUCCESS, qrMap);
  });

  // generate QR
  generateQR = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const wardenId = authReq.user?.id;
    const { hostelId, purpose } = req.body;

    await QRService.generateQRForHostel(
      hostelId,
      purpose,
      wardenId!.toString()
    );

    return sendSuccess(res, QR_GENERATED_SUCCESSFULLY);
  });

  // scan QR
  scanQR = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const studentId = authReq.user?.id;
    const { token } = req.body;

    if (!token || typeof token !== "string") {
      throw new BadRequestError(REQUIRED_FIELD("QR token"));
    }

    // Fetch hostelId here since middleware reversion removed it
    const student = await User.findById(studentId).select("hostelId");

    if (!student || !student.hostelId) {
      throw new BadRequestError(RECORD_NOT_FOUND("Student or assigned hostel"));
    }
    const studentHostelId = student.hostelId.toString();

    const result = await QRService.processScan({
      token,
      studentId: studentId!.toString(),
      studentHostelId,
    });

    return sendSuccess(res, result);
  });
}

export default new QRController();
