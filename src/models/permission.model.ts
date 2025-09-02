import mongoose, { Document, Schema } from "mongoose";

// Define the permission interface
export interface IPermission extends Document {
  roleId: mongoose.Types.ObjectId;
  routeId: mongoose.Types.ObjectId;
  add: boolean;
  view: boolean;
  edit: boolean;
  delete: boolean;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const PermissionSchema: Schema = new Schema<IPermission>(
  {
    roleId: {
      type: Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    routeId: {
      type: Schema.Types.ObjectId,
      ref: "Route",
      required: true,
    },
    add: {
      type: Boolean,
      default: false,
    },
    view: {
      type: Boolean,
      default: false,
    },
    edit: {
      type: Boolean,
      default: false,
    },
    delete: {
      type: Boolean,
      default: false,
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

const Permission = mongoose.model<IPermission>("Permission", PermissionSchema);
export default Permission;
