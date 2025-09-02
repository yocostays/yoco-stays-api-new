import { Schema, Document, model } from "mongoose";
import { TemplateTypes } from "../utils/enum";

//Define notification log interface
export interface INotificationLog extends Document {
  templateType: TemplateTypes;
  reason: string;
  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
}

//Define notification log Schema
const NotificationLogSchema: Schema = new Schema<INotificationLog>(
  {
    templateType: {
      type: String,
      enum: Object.values(TemplateTypes),
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const NotificationLog = model<INotificationLog>(
  "NotificatioLog",
  NotificationLogSchema
);

export default NotificationLog;
