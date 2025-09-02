import mongoose, { Document, Schema } from "mongoose";

// Define the User  Indisciplinary Action interface
export interface IIndisciplinaryActionDetails extends Document {
  studentId: mongoose.Types.ObjectId;
  staffId: mongoose.Types.ObjectId;
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
const StudentIndisciplinaryActionSchema: Schema<IIndisciplinaryActionDetails> =
  new Schema<IIndisciplinaryActionDetails>(
    {
      studentId: {
        type: Schema.Types.ObjectId,
        ref: "Student",
        required: true,
      },
      staffId: {
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

const StudentIndisciplinaryAction =
  mongoose.model<IIndisciplinaryActionDetails>(
    "StudentIndisciplinaryAction",
    StudentIndisciplinaryActionSchema
  );
export default StudentIndisciplinaryAction;
