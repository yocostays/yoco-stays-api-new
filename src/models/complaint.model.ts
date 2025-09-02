import mongoose, { Document, Schema } from "mongoose";
import {
  ComplainStatusTypes,
  ComplaintAttachmentTypes,
  ComplaintTypes,
} from "../utils/enum";

interface IAttachment {
  attachmentType: ComplaintAttachmentTypes;
  url: string;
}

// Define the interface for the update log entry
interface UpdateLog {
  assignedStaffId: mongoose.Types.ObjectId;
  complainStatus: ComplainStatusTypes;
  date: Date;
  remark: string;
  attachments: IAttachment[];
  updatedBy: mongoose.Types.ObjectId;
}

// Define the Complain interface
export interface IComplaint extends Document {
  ticketId: string;
  userId: mongoose.Types.ObjectId;
  hostelId: mongoose.Types.ObjectId;
  categoryType: ComplaintTypes;
  categoryId: mongoose.Types.ObjectId;
  subCategoryId: mongoose.Types.ObjectId;
  description: string;
  image: string;
  audio: string;
  complainStatus: ComplainStatusTypes;
  assignedStaff: mongoose.Types.ObjectId;
  assignDate: Date;
  resolvedDate: Date;
  resolvedTime: number;
  cancelledDate: Date;
  escalationDate: Date;
  escalationRemark: string;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  updateLogs: UpdateLog[];
  createdAt?: Date;
  updatedAt?: Date;
}

const AttachmentSchema = new Schema<IAttachment>({
  attachmentType: {
    type: String,
    enum: Object.values(ComplaintAttachmentTypes),
    required: true,
  },

  url: {
    type: String,
    required: true,
    trim: true,
  },
});

// Define the schema for the update log entry
const UpdateLogSchema = new Schema<UpdateLog>({
  assignedStaffId: {
    type: Schema.Types.ObjectId,
    ref: "Staff",
    required: false,
    default: null,
  },
  complainStatus: {
    type: String,
    enum: Object.values(ComplainStatusTypes),
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
    required: true,
  },
  remark: {
    type: String,
    required: true,
    trim: true,
  },
  attachments: {
    type: [AttachmentSchema],
    default: [],
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: "Staff",
    required: false,
    default: null,
  },
});

const ComplaintSchema: Schema = new Schema<IComplaint>(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hostelId: {
      type: Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },
    categoryType: {
      type: String,
      enum: Object.values(ComplaintTypes),
      required: false,
      default: ComplaintTypes.NOT_SELECTED,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "ComplainCategory",
      required: true,
    },
    subCategoryId: {
      type: Schema.Types.ObjectId,
      ref: "ComplainSubCategory",
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: false,
      default: null,
    },
    audio: {
      type: String,
      required: false,
      default: null,
    },
    complainStatus: {
      type: String,
      enum: Object.values(ComplainStatusTypes),
      required: false,
      default: ComplainStatusTypes.PENDING,
    },
    assignedStaff: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: false,
      default: null,
    },
    assignDate: {
      type: Date,
      required: false,
      default: null,
    },
    resolvedDate: {
      type: Date,
      required: false,
      default: null,
    },
    resolvedTime: {
      type: Number,
      required: false,
      default: 0,
    },
    escalationDate: {
      type: Date,
      required: false,
      default: null,
    },
    escalationRemark: {
      type: String,
      required: false,
      default: null,
    },
    updateLogs: [UpdateLogSchema],
    status: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
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

const Complaint = mongoose.model<IComplaint>("Complaint", ComplaintSchema);
export default Complaint;
