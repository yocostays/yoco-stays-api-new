import mongoose, { Schema, Document } from "mongoose";
import { UnitTypes } from "../utils/enum";

//Define data interface
export interface IWastageDetails extends Document {
  amount: number;
  unit: UnitTypes;
}

//Define foodWastage interface
export interface IFoodWastage extends Document {
  mealIds: mongoose.Types.ObjectId[]; // Changed to an array of ObjectId
  foodWastageNumber: string;
  startDate: Date;
  endDate: Date;
  breakfast: IWastageDetails;
  lunch: IWastageDetails;
  snacks: IWastageDetails;
  dinner: IWastageDetails;
  hostelId: mongoose.Types.ObjectId;
  totalWastage: number;
  totalUnit: UnitTypes;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

//Define schema for data
const WastageDetailsSchema: Schema = new Schema<IWastageDetails>({
  amount: { type: Number, required: true },
  unit: { type: String, enum: Object.values(UnitTypes), required: true },
});

//Define schema for foodWastage
const FoodWastageSchema: Schema = new Schema<IFoodWastage>(
  {
    mealIds: {
      type: [Schema.Types.ObjectId],
      ref: "MessMenu",
      required: true,
    },
    foodWastageNumber: {
      type: String,
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
    breakfast: {
      type: WastageDetailsSchema,
      required: false,
      default: null,
    },
    lunch: {
      type: WastageDetailsSchema,
      required: false,
      default: null,
    },
    snacks: {
      type: WastageDetailsSchema,
      required: false,
      default: null,
    },
    dinner: {
      type: WastageDetailsSchema,
      required: false,
      default: null,
    },
    hostelId: {
      type: Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },
    totalWastage: {
      type: Number,
      required: true,
      default: 0,
    },
    totalUnit: { type: String, enum: Object.values(UnitTypes), required: true },
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
  {
    timestamps: true,
  }
);

// Add indexes to frequently queried fields
FoodWastageSchema.index({ mealIds: 1, startDate: 1, endDate: 1 });
FoodWastageSchema.index({ hostelId: 1, startDate: 1, endDate: 1 });
FoodWastageSchema.index({ status: 1 }); // For quick lookups based on status

const FoodWastage = mongoose.model<IFoodWastage>(
  "FoodWastage",
  FoodWastageSchema
);
export default FoodWastage;
