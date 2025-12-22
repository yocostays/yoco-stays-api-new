
import mongoose, { Document, Schema } from "mongoose";

export interface IOtp extends Document {
  identifier: string; // Email or Phone
  channel: "EMAIL" | "SMS";
  purpose: string;
  otpHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
}

const OtpSchema: Schema = new Schema<IOtp>(
  {
    identifier: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ["EMAIL", "SMS"],
      required: true,
    },
    purpose: {
      type: String,
      required: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
  },
  { timestamps: true }
);

// Indexes
// Combined index for faster lookup of valid OTPs
OtpSchema.index({ identifier: 1, purpose: 1, usedAt: 1 });

// TTL Index: Delete after 24 hours (86400 seconds) so we can track daily limits
OtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

const Otp = mongoose.model<IOtp>("Otp", OtpSchema);
export default Otp;
