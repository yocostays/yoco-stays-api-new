import mongoose, { Document, Schema } from "mongoose";
import { ComplaintTypes } from "../utils/enum";

// Define the Category interface
export interface IComplainCategory extends Document {
  categoryType: ComplaintTypes;
  name: string;
  image: string;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const ComplainCategorySchema: Schema = new Schema<IComplainCategory>(
  {
    categoryType: {
      type: String,
      enum: Object.values(ComplaintTypes),
      required: false,
      default: ComplaintTypes.NOT_SELECTED,
      index: true, 
    },
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    image: {
      type: String,
      required: true,
    },
    status: {
      type: Boolean,
      default: true,
      index: true, 
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

// Compound index for filtering by categoryType and status together
ComplainCategorySchema.index({ categoryType: 1, status: 1 });

const ComplainCategory = mongoose.model<IComplainCategory>(
  "ComplainCategory",
  ComplainCategorySchema
);
export default ComplainCategory;
