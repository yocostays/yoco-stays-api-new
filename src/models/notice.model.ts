import { Schema, Document, model } from "mongoose";
import {
  NoticeTypes,
  PushNotificationTypes,
  TemplateTypes,
} from "../utils/enum";

//Define notification log
export interface INotificationLog extends Document {
  templateType: TemplateTypes;
  reason: string;
}

//Define notice interface
export interface INotice extends Document {
  userId: Schema.Types.ObjectId;
  hostelId: Schema.Types.ObjectId;
  floorNumber: number;
  bedType: number;
  roomNumber: number;
  noticeTypes: NoticeTypes;
  pushNotificationTypes: PushNotificationTypes;
  notificationLog: INotificationLog[];
  templateId: Schema.Types.ObjectId;
  templateSendMessage: string;
  isNoticeCreated: boolean;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

//Define notification log
const NotificationLogSchema: Schema = new Schema<INotificationLog>({
  templateType: {
    type: String,
    enum: Object.values(TemplateTypes),
    required: false,
    default: null,
  },
  reason: {
    type: String,
    required: false,
    default: null,
  },
});

//Define notice schema
const NoticeSchema: Schema = new Schema<INotice>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hostelId: {
      type: Schema.Types.ObjectId,
      ref: "Hostel",
      required: false,
      default: null,
    },
    floorNumber: {
      type: Number,
      required: false,
      default: 0,
    },
    bedType: {
      type: Number,
      required: false,
      default: null,
    },
    roomNumber: {
      type: Number,
      required: false,
      default: 0,
    },
    noticeTypes: {
      type: String,
      enum: Object.values(NoticeTypes),
      required: true,
    },
    pushNotificationTypes: {
      type: String,
      enum: Object.values(PushNotificationTypes),
      required: false,
      default: null,
    },
    notificationLog: [
      {
        type: NotificationLogSchema,
        required: false,
        default: [],
      },
    ],
    templateId: {
      type: Schema.Types.ObjectId,
      ref: "Template",
      required: false,
      default: null,
    },
    templateSendMessage: {
      type: String,
      required: false,
      default: null,
    },
    isNoticeCreated: {
      type: Boolean,
      default: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

NoticeSchema.index({ userId: 1, createdAt: -1 });
NoticeSchema.index({ userId: 1, isRead: 1 });

const Notice = model<INotice>("Notice", NoticeSchema);
export default Notice;
