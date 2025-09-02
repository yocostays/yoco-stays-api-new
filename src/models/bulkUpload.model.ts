import mongoose, { Document, Schema } from "mongoose";
import { BulkUploadTypes } from "../utils/enum";

// Define the bulk upload interface
export interface IBulkUpload extends Document {
  fileType: BulkUploadTypes;
  originalFile: string;
  successFile: string;
  errorFile: string;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const BulkUploadSchema: Schema = new Schema<IBulkUpload>(
  {
    fileType: {
      type: String,
      enum: Object.values(BulkUploadTypes),
      required: true,
      default: BulkUploadTypes.USER,
    },
    originalFile: {
      type: String,
      required: true,
    },
    successFile: {
      type: String,
      default: null,
      required: false,
    },
    errorFile: {
      type: String,
      default: null,
      required: false,
    },
    status: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
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

const BulkUpload = mongoose.model<IBulkUpload>("BulkUpload", BulkUploadSchema);
export default BulkUpload;
