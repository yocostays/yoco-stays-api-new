import mongoose, { Document, Schema } from "mongoose";
import { LeaveTypes } from "../utils/enum";

// Define the leave Category interface
export interface ILeaveCategory extends Document {
  name: string;
  categoryType: LeaveTypes;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const LeaveCategorySchema: Schema = new Schema<ILeaveCategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    categoryType: {
      type: String,
      enum: Object.values(LeaveTypes),
      default: LeaveTypes.LEAVE,
    },
    status: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: false,
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: false,
      default: null,
    },
  },
  { timestamps: true }
);

const LeaveCategory = mongoose.model<ILeaveCategory>(
  "LeaveCategory",
  LeaveCategorySchema
);
export default LeaveCategory;
