import mongoose, { Document, Schema } from "mongoose";
import { SchemeReferenceModelTypes } from "../utils/enum";

export interface IOtp extends Document {
  userId: mongoose.Types.ObjectId;
  userModel: SchemeReferenceModelTypes | null; 
  phone: string;
  otp: number;
  email:string;
  expiryTime: Date;
  isVerified: boolean;
  status: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const OtpSchema: Schema = new Schema<IOtp>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      refPath: "userModel",
      required: false,
      default: null,
    },
    email:{
      type:String,
      required:false,
      default:null,
      unique:true
    },
    userModel: {
      type: String,
      enum: Object.values(SchemeReferenceModelTypes),
      required: true,
      default: null, 
    },
    phone: {
      type: String,
      required: false,
      default: null,
    },
    otp: {
      type: Number,
      required: true,
    },
    expiryTime: {
      type: Date,
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
  },
  { timestamps: true }
);

OtpSchema.index({ phone: 1 });
OtpSchema.index({ userId: 1 });
OtpSchema.index({ userModel: 1 });
OtpSchema.index({ expiryTime: 1 }, { expireAfterSeconds: 0 });

const Otp = mongoose.model<IOtp>("Otp", OtpSchema);
export default Otp;
