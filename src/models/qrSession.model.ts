import mongoose, { Document, Schema } from "mongoose";
import { QRPurpose } from "../utils/enum";

export interface IQRSession extends Document {
  token: string;
  purpose: QRPurpose;
  hostelId: mongoose.Types.ObjectId;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  rotatedAt?: Date;
}

const QRSessionSchema: Schema<IQRSession> = new Schema<IQRSession>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },
    purpose: {
      type: String,
      enum: Object.values(QRPurpose),
      required: true,
      default: QRPurpose.MESS_ATTENDANCE,
    },
    hostelId: {
      type: Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    rotatedAt: {
      type: Date,
      required: false,
      default: null,
    },
  },
  { timestamps: true }
);

// Ensure only one active QR per hostel per purpose at the DB level
QRSessionSchema.index(
  { hostelId: 1, purpose: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

const QRSession = mongoose.model<IQRSession>("QRSession", QRSessionSchema);

export default QRSession;
