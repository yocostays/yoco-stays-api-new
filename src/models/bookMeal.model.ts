import mongoose, { Document, Schema } from "mongoose";
import {
  MealBookingStatusTypes,
  MealBookingIntent,
  MealCancelSource,
} from "../utils/enum";

export interface IMealState {
  bookingIntent: MealBookingIntent;
  consumed: boolean;
  consumedAt?: Date;
  cancelSource?: MealCancelSource;
}

export interface IMealsObject {
  breakfast?: IMealState;
  lunch?: IMealState;
  snacks?: IMealState;
  dinner?: IMealState;
}

export interface IBookMealsDetails extends Document {
  mealId: mongoose.Types.ObjectId;
  bookMealNumber: string;
  hostelId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  date: Date;

  // Legacy boolean fields - null = meal not available in menu
  isBreakfastBooked: boolean | null;
  isLunchBooked: boolean | null;
  isDinnerBooked: boolean | null;
  isSnacksBooked: boolean | null;

  cancellationReason: string;
  bookingStatus: MealBookingStatusTypes;
  status: boolean;
  isManualBooking: boolean;
  mealCount: number;
  staffId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;

  // New meal-level state machine
  meals?: IMealsObject;
}

const MealStateSchema = new Schema<IMealState>(
  {
    bookingIntent: {
      type: String,
      enum: Object.values(MealBookingIntent),
      required: true, //
    },
    // TEMPORARY: defaults to true until biometric/punch system is implemented
    consumed: {
      type: Boolean,
      default: true,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    cancelSource: {
      type: String,
      enum: [...Object.values(MealCancelSource), null],
      default: null,
    },
  },
  { _id: false }
);

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

    // Legacy boolean fields - null = meal not available in menu
    isBreakfastBooked: {
      type: Boolean,
      required: false,
      default: null,
    },
    isLunchBooked: {
      type: Boolean,
      required: false,
      default: null,
    },
    isSnacksBooked: {
      type: Boolean,
      required: false,
      default: null,
    },
    isDinnerBooked: {
      type: Boolean,
      required: false,
      default: null,
    },

    mealCount: {
      type: Number,
      required: true,
      default: 0,
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

    // New meal-level state machine (optional for gradual adoption)
    meals: {
      type: {
        breakfast: { type: MealStateSchema, default: undefined },
        lunch: { type: MealStateSchema, default: undefined },
        snacks: { type: MealStateSchema, default: undefined },
        dinner: { type: MealStateSchema, default: undefined },
      },
      required: false,
      default: undefined,
    },
  },
  { timestamps: true }
);

// Indexes - all existing indexes preserved
BookMealsSchema.index({ mealId: 1, date: 1 });
BookMealsSchema.index({ hostelId: 1, studentId: 1, date: 1 });
BookMealsSchema.index({ bookingStatus: 1 });
BookMealsSchema.index({ studentId: 1, date: 1 });
BookMealsSchema.index({ staffId: 1 });
BookMealsSchema.index({ staffId: 1, date: 1 });
BookMealsSchema.index({ status: 1 });

// TTL Index: Auto-delete records after 450 days
BookMealsSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 450 * 24 * 60 * 60 }
);

const BookMeals = mongoose.model<IBookMealsDetails>(
  "BookMeals",
  BookMealsSchema
);
export default BookMeals;
