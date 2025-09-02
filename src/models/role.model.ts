import mongoose, { Document, Schema } from "mongoose";
import { ComplaintTypes } from "../utils/enum";

// Define the Role interface
export interface IRole extends Document {
  categoryType: ComplaintTypes;
  name: string;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const RoleSchema: Schema = new Schema<IRole>(
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
    },
    status: {
      type: Boolean,
      default: true, 
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff", 
      required: false,
      default:null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff", 
      required: false,
      default:null,
    },
  },
  { timestamps: true }
);

const Role = mongoose.model<IRole>("Role", RoleSchema);
export default Role;
