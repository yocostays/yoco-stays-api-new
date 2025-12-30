import mongoose, { Document, Schema } from "mongoose";
import { MealBookingIntent, MealCancelSource } from "../utils/enum";

export interface IMealState {
  status: MealBookingIntent; // PENDING | CONFIRMED | SKIPPED
  locked: boolean;
  consumed: boolean;
  consumedAt?: Date;
  cancelSource?: MealCancelSource;
}

export interface IMealsObject {
  breakfast: IMealState;
  lunch: IMealState;
  snacks: IMealState;
  dinner: IMealState;
}

export interface IBookMealsDetails extends Document {
  mealId: mongoose.Types.ObjectId;
  bookMealNumber: string;
  hostelId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  date: Date;
  cancellationReason: string;
  staffId: mongoose.Types.ObjectId;

  // New pure state-based structure
  meals: IMealsObject;

  isManualBooking: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const MealStateSchema = new Schema<IMealState>(
  {
    status: {
      type: String,
      enum: Object.values(MealBookingIntent),
      default: MealBookingIntent.PENDING,
      required: true,
    },
    locked: {
      type: Boolean,
      default: false,
      required: true,
    },
    consumed: {
      type: Boolean,
      default: false,
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

const MealsSchema = new Schema<IMealsObject>(
  {
    breakfast: {
      type: MealStateSchema,
      default: () => ({ status: MealBookingIntent.PENDING, locked: false }),
    },
    lunch: {
      type: MealStateSchema,
      default: () => ({ status: MealBookingIntent.PENDING, locked: false }),
    },
    snacks: {
      type: MealStateSchema,
      default: () => ({ status: MealBookingIntent.PENDING, locked: false }),
    },
    dinner: {
      type: MealStateSchema,
      default: () => ({ status: MealBookingIntent.PENDING, locked: false }),
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
    cancellationReason: {
      type: String,
      required: false,
      default: null,
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

    // Pure state-based meal structure
    meals: {
      type: MealsSchema as any,
      required: true,
      default: () => ({
        breakfast: { status: MealBookingIntent.PENDING, locked: false },
        lunch: { status: MealBookingIntent.PENDING, locked: false },
        snacks: { status: MealBookingIntent.PENDING, locked: false },
        dinner: { status: MealBookingIntent.PENDING, locked: false },
      }),
    },
  },
  { timestamps: true }
);

// Indexes
BookMealsSchema.index({ mealId: 1, date: 1 });
BookMealsSchema.index({ hostelId: 1, studentId: 1, date: 1 });
BookMealsSchema.index({ studentId: 1, date: 1 });
BookMealsSchema.index({ staffId: 1 });
BookMealsSchema.index({ staffId: 1, date: 1 });

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
