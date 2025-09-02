import mongoose, { Document, Schema } from "mongoose";
import {
  LeaveStatusTypes,
  LeaveApproveStatusTypes,
  LeaveTypes,
} from "../utils/enum";

// Define the interface for the update log entry
interface UpdateLog {
  leaveStatus: LeaveStatusTypes;
  approvalStatus: LeaveApproveStatusTypes;
  date: Date;
  remark: string;
  updatedBy: mongoose.Types.ObjectId;
}

// Define the leave interface
export interface IStudentLeave extends Document {
  ticketId: string;
  gatepassNumber: string;
  userId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  hostelId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  days: number;
  hours: string;
  description: string;
  visitorName: string;
  visitorNumber: number;
  leaveStatus: LeaveStatusTypes;
  approvalStatus: LeaveApproveStatusTypes;
  approvedDate: Date;
  cancelledDate: Date;
  leaveType: LeaveTypes;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  updateLogs: UpdateLog[]; 
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the schema for the update log entry
const UpdateLogSchema = new Schema<UpdateLog>({
  leaveStatus: {
    type: String,
    enum: Object.values(LeaveStatusTypes),
    required: true,
  },
  approvalStatus: {
    type: String,
    enum: Object.values(LeaveApproveStatusTypes),
    required: true,
  },
  date: {
    type: Date,
    required: false,
    default: null,
  },
  remark: {
    type: String,
    required: false,
    trim: true,
    default: null,
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: "Staff",
    required: false,
    default: null,
  },
});

const StudentLeaveSchema: Schema = new Schema<IStudentLeave>(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
    },
    gatepassNumber: {
      type: String,
      required: false,
      default: null,
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
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "LeaveCategory",
      required: false,
      default: null,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    days: {
      type: Number,
      required: false,
      default: 0,
    },
    hours: {
      type: String,
      required: false,
      default: null,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    visitorName: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
    visitorNumber: {
      type: Number,
      required: false,
      trim: true,
      default: null,
    },
    leaveStatus: {
      type: String,
      enum: Object.values(LeaveStatusTypes),
      required: false,
      default: LeaveStatusTypes.PENDING,
    },
    approvalStatus: {
      type: String,
      enum: Object.values(LeaveApproveStatusTypes),
      required: false,
      default: LeaveApproveStatusTypes.PENDING_APPROVAL,
    },
    approvedDate: {
      type: Date,
      required: false,
      default: null,
    },
    cancelledDate: {
      type: Date,
      required: false,
      default: null,
    },
    updateLogs: [UpdateLogSchema],
    leaveType: {
      type: String,
      enum: Object.values(LeaveTypes),
      required: false,
      default: LeaveTypes.LEAVE,
    },
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

const StudentLeave = mongoose.model<IStudentLeave>(
  "StudentLeave",
  StudentLeaveSchema
);
export default StudentLeave;
