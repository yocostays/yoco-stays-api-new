import mongoose, { Document, Schema } from "mongoose";
import { AnnouncementStatus, EventStatus, AttachmentType } from "../utils/enum";

// Define attachment interface
export interface IAttachment {
  type: AttachmentType;
  url: string; // S3 path for FILE type, external URL for LINK type
  name?: string; // Optional display name
}

// Define the announcement interface
export interface IAnnouncement extends Document {
  announcementId: string;
  title: string;
  eventName?: string;
  eventTagline?: string;
  images: string[];
  attachment?: IAttachment;
  publishFrom: Date;
  publishTo: Date;
  date?: string;
  time?: string;
  venue?: string;
  hostelId: mongoose.Types.ObjectId;
  activeStudentsOnly: boolean;
  isHidden: boolean;
  eventStatus: EventStatus;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const AnnouncementSchema: Schema = new Schema<IAnnouncement>(
  {
    announcementId: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    eventName: {
      type: String,
      trim: true,
      default: null,
    },
    eventTagline: {
      type: String,
      trim: true,
      default: null,
    },
    images: {
      type: [String],
      required: true,
      validate: {
        validator: function (v: string[]) {
          return v && v.length >= 1 && v.length <= 5;
        },
        message: "Images array must contain between 1 and 5 items",
      },
    },
    attachment: {
      type: new Schema(
        {
          type: {
            type: String,
            enum: Object.values(AttachmentType),
          },
          url: { type: String },
          name: { type: String },
        },
        { _id: false },
      ),
    },
    publishFrom: {
      type: Date,
      required: true,
    },
    publishTo: {
      type: Date,
      required: true,
    },
    date: {
      type: String,
      trim: true,
      default: null,
    },
    time: {
      type: String,
      trim: true,
      default: null,
    },
    venue: {
      type: String,
      trim: true,
      default: null,
    },
    hostelId: {
      type: Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },
    activeStudentsOnly: {
      type: Boolean,
      default: false,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    eventStatus: {
      type: String,
      enum: Object.values(EventStatus),
      default: EventStatus.ACTIVE,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },
  },
  { timestamps: true },
);

const Announcement = mongoose.model<IAnnouncement>(
  "Announcement",
  AnnouncementSchema,
);
export default Announcement;
