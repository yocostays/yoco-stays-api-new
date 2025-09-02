import mongoose, { Document, Schema } from "mongoose";

// Define the course interface
export interface ICourse extends Document {
  name: string;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const CourseSchema: Schema = new Schema<ICourse>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
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

// Add indexes
CourseSchema.index({ name: 1 }); 
CourseSchema.index({ status: 1 }); 
CourseSchema.index({ createdBy: 1 });
CourseSchema.index({ updatedBy: 1 }); 

// Create the model
const Course = mongoose.model<ICourse>("Course", CourseSchema);
export default Course;
