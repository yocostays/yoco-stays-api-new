import { Request, Response } from "express";
import QRService from "../services/qr.service";
import { sendSuccess } from "../utils/responseHelpers";
import { SUCCESS_MESSAGES } from "../utils/messages";
import { asyncHandler } from "../utils/asyncHandler";

const { QR_GENERATED_SUCCESSFULLY } = SUCCESS_MESSAGES;

class QRController {
  generateQR = asyncHandler(async (req: Request, res: Response) => {
    const wardenId = req.body._valid?._id;
    const { hostelId, purpose } = req.body;

    try {
      const qrImage = await QRService.generateQRForHostel(
        hostelId,
        purpose,
        wardenId.toString()
      );

      return sendSuccess(res, QR_GENERATED_SUCCESSFULLY, { qrImage });
    } catch (error: any) {
      if (error.message.includes("Regeneration limit reached")) {
        return res.status(429).json({
          statusCode: 429,
          message: error.message,
        });
      }
      throw error; 
    }
  });
}

export default new QRController();
