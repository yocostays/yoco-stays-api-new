import mongoose, { Document, Schema } from "mongoose";
import { BillingCycleTypes, PaymentStatusTypes } from "../utils/enum";

// Billing cycle details interface
export interface IBillingCycleDetails extends Document {
  billingDate: Date;
  paymentDate: Date;
  amount: number;
  paymentStatus: PaymentStatusTypes;
}

// Define the UserHostelAssignment interface
export interface IUserHostelAssignment extends Document {
  studentId: mongoose.Types.ObjectId;
  hostelId: mongoose.Types.ObjectId;
  buildingNumber: string;
  bedType: number;
  roomNumber: number;
  bedNumber: string;
  floorNumber: number;
  securityFee: number;
  billingCycle: BillingCycleTypes;
  joiningDate: Date;
  leaveDate: Date;
  billingCycleDetails: IBillingCycleDetails[];
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the schema for BillingCycleDetails
const BillingCycleDetailsSchema: Schema<IBillingCycleDetails> =
  new Schema<IBillingCycleDetails>({
    billingDate: {
      type: Date,
      required: true,
    },
    paymentDate: {
      type: Date,
      required: false,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatusTypes),
      required: true,
    },
  });

// Define the schema for UserHostelAssignment
const StudentHostelAllocationSchema: Schema<IUserHostelAssignment> =
  new Schema<IUserHostelAssignment>(
    {
      studentId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      hostelId: {
        type: Schema.Types.ObjectId,
        ref: "Hostel",
        required: true,
      },
      buildingNumber: {
        type: String,
        required: true,
      },
      bedType: {
        type: Number,
        required: true,
      },
      roomNumber: {
        type: Number,
        required: true,
      },
      bedNumber: {
        type: String,
        required: true,
      },
      floorNumber: {
        type: Number,
        required: true,
      },
      securityFee: {
        type: Number,
        required: true,
      },
      billingCycle: {
        type: String,
        enum: Object.values(BillingCycleTypes),
        required: true,
      },
      billingCycleDetails: [BillingCycleDetailsSchema],
      joiningDate: {
        type: Date,
        required: true,
      },
      leaveDate: {
        type: Date,
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

const StudentHostelAllocation = mongoose.model<IUserHostelAssignment>(
  "StudentHostelAllocation",
  StudentHostelAllocationSchema
);
export default StudentHostelAllocation;
