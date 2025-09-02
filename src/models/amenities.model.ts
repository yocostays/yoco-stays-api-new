import mongoose, { Document, Schema } from "mongoose";

// Define the amenities interface
export interface IAmenities extends Document {
  name: string;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const AmenitiesSchema: Schema = new Schema<IAmenities>(
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
AmenitiesSchema.index({ name: 1 });
AmenitiesSchema.index({ status: 1 });
AmenitiesSchema.index({ createdBy: 1 });
AmenitiesSchema.index({ updatedBy: 1 });

// Create the model
const Amenities = mongoose.model<IAmenities>("Amenities", AmenitiesSchema);
export default Amenities;
