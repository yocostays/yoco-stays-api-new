import mongoose, { Document, Schema } from "mongoose";

// Define the Staff Indisciplinary Action interface
export interface ISIndisciplinaryActionDetails extends Document {
  staffId: mongoose.Types.ObjectId;
  reportedBy: mongoose.Types.ObjectId;
  remark: string;
  isFine: boolean;
  fineAmount: number;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the schema for UserHostelAssignment
const StaffIndisciplinaryActionSchema: Schema<ISIndisciplinaryActionDetails> =
  new Schema<ISIndisciplinaryActionDetails>(
    {
      staffId: {
        type: Schema.Types.ObjectId,
        ref: "Staff",
        required: true,
      },
      reportedBy: {
        type: Schema.Types.ObjectId,
        ref: "Staff",
        required: true,
      },
      remark: {
        type: String,
        required: true,
      },
      isFine: {
        type: Boolean,
        required: true,
        default: false,
      },
      fineAmount: {
        type: Number,
        required: true,
        default: 0,
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

const StaffIndisciplinaryAction =
  mongoose.model<ISIndisciplinaryActionDetails>(
    "StaffIndisciplinaryAction",
    StaffIndisciplinaryActionSchema
  );
export default StaffIndisciplinaryAction;
