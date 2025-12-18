import Otp, { IOtp } from "../models/otp.model";
import { OtpPurpose, OtpChannel } from "../validators/otp.schema";
import { generateSecureOtp, getExpiryDate } from "../utils/otpService";
import { hashPassword, comparePassword } from "../utils/hashUtils";
import { sendSMS } from "../utils/commonService/messagingService";
import nodemailer from "nodemailer";

// Interface for Request
interface IRequestOtp {
  identifier: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
}

// Interface for Verify
interface IVerifyOtp {
  identifier: string;
  purpose: OtpPurpose;
  otp: string;
}

class OtpService {
  private transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAL_PORT ? parseInt(process.env.EMAL_PORT) : 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  //Request an OTP

  async requestOtp({
    identifier,
    channel,
    purpose,
  }: IRequestOtp): Promise<string> {
    // Check Daily Limit (Max 5)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const count = await Otp.countDocuments({
      identifier,
      createdAt: { $gte: startOfDay },
    });

    if (count >= 5) {
      throw new Error("Daily OTP limit reached. Please try again tomorrow.");
    }

    const otpNum = generateSecureOtp();
    const otpStr = String(otpNum).padStart(6, "0");

    const otpHash = await hashPassword(otpStr, 10); // Salt 10 for speed

    const expiresAt = getExpiryDate(5, "M");

    await Otp.create({
      identifier,
      channel,
      purpose,
      otpHash,
      expiresAt,
      createdAt: new Date(),
    });

    if (channel === OtpChannel.EMAIL) {
      await this.sendEmail(identifier, otpStr, purpose);
    } else if (channel === OtpChannel.SMS) {
      await sendSMS(identifier, otpStr);
    }

    return otpStr;
  }

  // Verify an OTP

  async verifyOtp({ identifier, purpose, otp }: IVerifyOtp): Promise<boolean> {
    const otpRecord = await Otp.findOne({
      identifier,
      purpose,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      throw new Error("Invalid or Expired OTP");
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      throw new Error("Too many attempts. OTP invalidated.");
    }

    const isValid = await comparePassword(otp, otpRecord.otpHash);

    if (!isValid) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      throw new Error("Invalid OTP");
    }

    otpRecord.usedAt = new Date();
    await otpRecord.save();

    return true;
  }

  // Send OTP Email
  private async sendEmail(email: string, otp: string, purpose: string) {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; background: #f9fafb; padding: 20px; border-radius: 10px; text-align: center; color: #333;">
        <p style="font-size: 16px; margin-bottom: 10px;">Your OTP Code for ${purpose}:</p>
        <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #007bff; background: #fff; padding: 10px 20px; border-radius: 8px; display: inline-block;">
          ${otp}
        </div>
        <p style="font-size: 14px; margin-top: 10px; color: #666;">Valid for 5 minutes.</p>
      </div>
    `;

    await this.transporter.sendMail({
      from: `Yoco Stays ${process.env.EMAIL_FROM}`,
      to: email,
      subject: "Your OTP Code 🔐",
      html: htmlContent,
    });
  }
}

export default new OtpService();
