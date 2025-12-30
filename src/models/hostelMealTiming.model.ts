import mongoose, { Document, Schema } from "mongoose";

export interface IHostelMealTiming extends Document {
  hostelId: mongoose.Types.ObjectId;

  // Breakfast time window
  breakfastStartTime: string;
  breakfastEndTime: string;

  // Lunch time window
  lunchStartTime: string;
  lunchEndTime: string;

  // Snacks time window
  snacksStartTime: string;
  snacksEndTime: string;

  // Dinner time window
  dinnerStartTime: string;
  dinnerEndTime: string;

  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const HostelMealTimingSchema: Schema = new Schema<IHostelMealTiming>(
  {
    hostelId: {
      type: Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
      unique: true,
    },

    breakfastStartTime: {
      type: String,
      required: true,
    },
    breakfastEndTime: {
      type: String,
      required: true,
    },

    lunchStartTime: {
      type: String,
      required: true,
    },
    lunchEndTime: {
      type: String,
      required: true,
    },

    snacksStartTime: {
      type: String,
      required: true,
    },
    snacksEndTime: {
      type: String,
      required: true,
    },

    dinnerStartTime: {
      type: String,
      required: true,
    },
    dinnerEndTime: {
      type: String,
      required: true,
    },

    status: {
      type: Boolean,
      required: true,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

// Query optimization indexes
HostelMealTimingSchema.index({ status: 1 });

const HostelMealTiming = mongoose.model<IHostelMealTiming>(
  "HostelMealTiming",
  HostelMealTimingSchema
);

export default HostelMealTiming;
