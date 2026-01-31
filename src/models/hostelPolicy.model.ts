import mongoose, { Document, Schema } from "mongoose";

export interface IMealCutoff {
  dayOffset: number;
  time: string;
}

export interface IBookingCutoffs {
  breakfast: IMealCutoff;
  lunch: IMealCutoff;
  snacks: IMealCutoff;
  dinner: IMealCutoff;
}

export interface IHostelPolicy extends Document {
  hostelId: mongoose.Types.ObjectId;
  bookingCutoffs: IBookingCutoffs;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const MealCutoffSchema = new Schema<IMealCutoff>(
  {
    dayOffset: {
      type: Number,
      required: true,
      default: 0,
    },
    time: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const HostelPolicySchema: Schema = new Schema<IHostelPolicy>(
  {
    hostelId: {
      type: Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },

    bookingCutoffs: {
      type: {
        breakfast: { type: MealCutoffSchema, required: true },
        lunch: { type: MealCutoffSchema, required: true },
        snacks: { type: MealCutoffSchema, required: true },
        dinner: { type: MealCutoffSchema, required: true },
      },
      required: true,
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

// One policy per hostel
HostelPolicySchema.index({ hostelId: 1 }, { unique: true });
HostelPolicySchema.index({ status: 1 });

const HostelPolicy = mongoose.model<IHostelPolicy>(
  "HostelPolicy",
  HostelPolicySchema
);

export default HostelPolicy;
