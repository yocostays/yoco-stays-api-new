import mongoose, { Document, Schema } from "mongoose";
import { MealBookingStatusTypes } from "../utils/enum";

// Define the BookMealsDetails interface
export interface IBookMealsDetails extends Document {
  mealId: mongoose.Types.ObjectId;
  bookMealNumber: string;
  hostelId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  date: Date;
  isBreakfastBooked: boolean;
  isLunchBooked: boolean;
  isDinnerBooked: boolean;
  isSnacksBooked: boolean;
  cancellationReason: string;
  bookingStatus: MealBookingStatusTypes;
  status: boolean;
  isManualBooking: boolean;
  staffId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the BookMealsSchema
const BookMealsSchema: Schema = new Schema<IBookMealsDetails>(
  {
    mealId: {
      type: Schema.Types.ObjectId,
      ref: "MessMenu",
      required: true,
    },
    bookMealNumber: {
      type: String,
      required: false,
      default: null,
    },
    hostelId: {
      type: Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    isBreakfastBooked: {
      type: Boolean,
      required: true,
      default: false,
    },
    isLunchBooked: {
      type: Boolean,
      required: true,
      default: false,
    },
    isSnacksBooked: {
      type: Boolean,
      required: true,
      default: false,
    },
    isDinnerBooked: {
      type: Boolean,
      required: true,
      default: false,
    },
    cancellationReason: {
      type: String,
      required: false,
      default: null,
    },
    bookingStatus: {
      type: String,
      enum: Object.values(MealBookingStatusTypes),
      required: true,
      default: MealBookingStatusTypes.BOOKED,
    },

    staffId: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: false,
      default: null,
    },
    isManualBooking: {
      type: Boolean,
      default: false,
    },
    status: {
      type: Boolean,
      required: true,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
  },
  { timestamps: true }
);

// Add indexes to frequently queried fields
BookMealsSchema.index({ mealId: 1, date: 1 });
BookMealsSchema.index({ hostelId: 1, studentId: 1, date: 1 });
BookMealsSchema.index({ bookingStatus: 1 });
BookMealsSchema.index({ studentId: 1, date: 1 });
BookMealsSchema.index({ staffId: 1 });
BookMealsSchema.index({ staffId: 1, date: 1 });
BookMealsSchema.index({ status: 1 });

// Define the BookMeals model
const BookMeals = mongoose.model<IBookMealsDetails>(
  "BookMeals",
  BookMealsSchema
);
export default BookMeals;
