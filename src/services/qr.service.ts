import crypto from "crypto";
import QRCode from "qrcode";
import QRSession from "../models/qrSession.model";
import { QRPurpose } from "../utils/enum";
import mongoose from "mongoose";

class QRService {
  // Generates a random token for QR
  private generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // Generates QR code image as base64 data URL from token
  private async generateQRImage(token: string): Promise<string> {
    try {
      // Generate QR code as data URL (base64-encoded PNG)
      const qrDataURL = await QRCode.toDataURL(token, {
        errorCorrectionLevel: "M",
        type: "image/png",
        width: 512,
        margin: 2,
      });
      return qrDataURL;
    } catch (error) {
      throw new Error("Failed to generate QR code image");
    }
  }

  // Generates QR for a hostel by deactivating any existing one and creating a new one
  async generateQRForHostel(
    hostelId: string,
    purpose: QRPurpose,
    createdBy: string
  ): Promise<string> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    //Check regeneration limit: Max 5 per hour per hostel/purpose
    const generationCount = await QRSession.countDocuments({
      hostelId: new mongoose.Types.ObjectId(hostelId),
      purpose,
      createdAt: { $gte: oneHourAgo },
    });

    if (generationCount >= 5) {
      throw new Error(
        "Regeneration limit reached. Please wait before generating a new QR code."
      );
    }

    //Deactivate any existing active QR for this hostel+purpose
    await QRSession.updateMany(
      {
        hostelId: new mongoose.Types.ObjectId(hostelId),
        purpose,
        isActive: true,
      },
      {
        $set: {
          isActive: false,
          rotatedAt: new Date(),
        },
      }
    );

    //Generate new unique token
    let token: string;
    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    //Handle rare token collision with retry logic
    while (attempts < MAX_ATTEMPTS) {
      token = this.generateToken();
      attempts++;

      try {
        //Create new QR session
        const qrSession = new QRSession({
          token,
          purpose,
          hostelId: new mongoose.Types.ObjectId(hostelId),
          isActive: true,
          createdBy: new mongoose.Types.ObjectId(createdBy),
        });

        await qrSession.save();

        // Generate and return QR image
        const qrImage = await this.generateQRImage(token);
        return qrImage;
      } catch (error: any) {
        // Check for duplicate key error (token collision)
        if (error.code === 11000 && attempts < MAX_ATTEMPTS) {
          // Retry with new token
          continue;
        }

        // Other errors or max attempts reached
        throw error;
      }
    }

    // Should never reach here, but handle edge case
    throw new Error(
      "Failed to generate unique QR token after multiple attempts"
    );
  }
}
export default new QRService();
