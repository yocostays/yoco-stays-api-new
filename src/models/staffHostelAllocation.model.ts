import mongoose, { Document, Schema } from "mongoose";

// Define the Staff Hostel Assignment interface
export interface IStaffHostelAssignment extends Document {
  staffId: mongoose.Types.ObjectId;
  hostelId: mongoose.Types.ObjectId;
  bedType: number;
  roomNumber: number;
  bedNumber: string;
  floorNumber: number;
  joiningDate: Date;
  leaveDate: Date;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the schema for StaffHostelAssignment
const StaffHostelAllocationSchema: Schema<IStaffHostelAssignment> =
  new Schema<IStaffHostelAssignment>(
    {
      staffId: {
        type: Schema.Types.ObjectId,
        ref: "Staff",
        required: true,
      },
      hostelId: {
        type: Schema.Types.ObjectId,
        ref: "Hostel",
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

const StaffHostelAllocation = mongoose.model<IStaffHostelAssignment>(
  "StaffHostelAllocation",
  StaffHostelAllocationSchema
);
export default StaffHostelAllocation;
