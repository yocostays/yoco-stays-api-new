import mongoose, { Document, Schema } from "mongoose";

// Define the route interface
export interface IRoute extends Document {
  uniqueId: string;
  title: string;
  link: string;
  icon: string;
  platform: string;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const RouteSchema: Schema = new Schema<IRoute>(
  {
    uniqueId: {
      type: String,
      unique: true,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    link: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      enum: ["web", "mobile"],
      required: true,
      default: "web",
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

// Compound indexes to ensure unique title and link per platform
RouteSchema.index({ platform: 1, title: 1 }, { unique: true });
RouteSchema.index({ platform: 1, link: 1 }, { unique: true });

const Route = mongoose.model<IRoute>("Route", RouteSchema);
export default Route;
