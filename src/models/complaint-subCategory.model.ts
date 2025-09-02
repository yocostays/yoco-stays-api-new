import mongoose, { Document, Schema } from "mongoose";

// Define the Complain sub Category interface
export interface IComplainSubCategory extends Document {
  categoryId: mongoose.Types.ObjectId;
  name: string;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const ComplainSubCategorySchema: Schema = new Schema<IComplainSubCategory>(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "ComplainCategory",
      required: true,
    },
    name: {
      type: String,
      required: true,
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

const ComplainSubCategory = mongoose.model<IComplainSubCategory>(
  "ComplainSubCategory",
  ComplainSubCategorySchema
);
export default ComplainSubCategory;
