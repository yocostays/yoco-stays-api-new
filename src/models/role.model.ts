import mongoose, { Document, Schema } from "mongoose";

// Define the Role interface
export interface IRole extends Document {
  categoryType: string;
  uniqueId: string;
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
      required: true,
      unique: true,
      index: true,
    },
    uniqueId: {
      type: String,
      unique: true,
      required: true,
    },
    name: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
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
  { timestamps: true },
);

const Role = mongoose.model<IRole>("Role", RoleSchema);
export default Role;
