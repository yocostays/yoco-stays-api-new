import mongoose, { Document, Schema } from "mongoose";
import { DaysTypes } from "../utils/enum";

// Define the MessManagement interface
export interface IMessMenu extends Document {
  uniqueId: string;
  hostelId: mongoose.Types.ObjectId;
  date: Date;
  day: DaysTypes;
  breakfast: string;
  lunch: string;
  snacks: string;
  dinner: string;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the MessManagement Schema
const MessMenuSchema: Schema = new Schema<IMessMenu>(
  {
    uniqueId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    hostelId: {
      type: Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    day: {
      type: String,
      enum: Object.values(DaysTypes),
      required: true,
    },
    breakfast: {
      type: String,
      required: true,
    },
    lunch: {
      type: String,
      required: true,
    },
    snacks: {
      type: String,
      required: true,
    },
    dinner: {
      type: String,
      required: true,
    },
    status: {
      type: Boolean,
      required: true,
      default: true,
      index: true, 
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
      index: true, 
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

// Compound Indexes for Efficient Queries
MessMenuSchema.index({ hostelId: 1, date: 1 }, { unique: true });
MessMenuSchema.index({ status: 1, date: -1 });

// Define the MessManagement model
const MessMenu = mongoose.model<IMessMenu>("MessMenu", MessMenuSchema);
export default MessMenu;
