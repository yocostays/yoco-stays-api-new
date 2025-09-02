import mongoose, { Document, Schema } from "mongoose";
import {
  BillingCycleTypes,
  HostelTypes,
  MealTypes,
  RoomTypes,
} from "../utils/enum";

// Define CountryDetails Interface
export interface ICountryDetails extends Document {
  countryId: number;
  name: string;
  iso2: string;
}

// Define StateDetails Interface
export interface IStateDetails extends Document {
  stateId: number;
  name: string;
  iso2: string;
}

// Define CityDetails Interface
export interface ICityDetails extends Document {
  name: string;
  cityId: number;
}

// Define LocationDetails Interface
export interface ILocationDetails extends Document {
  state: IStateDetails;
  city: ICityDetails;
  country: ICountryDetails;
}

// Define HostelDetails Interface
export interface IHostelDetailsDetails extends Document {
  hostelType: HostelTypes;
  noOfBuildings: number;
  noOfBeds: number;
}

// Define College Interface
export interface ICollege extends Document {
  totalCapacity: number;
  name: string;
  address: string;
  googleMapLink: string;
  location: ILocationDetails;
  courseIds: mongoose.Types.ObjectId[];
  hostelDetails: IHostelDetailsDetails[];
  roomTypes: RoomTypes[];
  paymentTypes: BillingCycleTypes[];
  mealTypes: MealTypes[];
  evChargingStation: number;
  parkingSpaces: number;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define Country Schema
const CountrySchema: Schema<ICountryDetails> = new Schema<ICountryDetails>({
  countryId: { type: Number, required: true },
  name: { type: String, required: true },
  iso2: { type: String, required: true },
});

// Define State Schema
const StateSchema: Schema<IStateDetails> = new Schema<IStateDetails>({
  stateId: { type: Number, required: true },
  name: { type: String, required: true },
  iso2: { type: String, required: true },
});

// Define City Schema
const CitySchema: Schema<ICityDetails> = new Schema<ICityDetails>({
  name: { type: String, required: true },
  cityId: { type: Number, required: true },
});

// Define Location Schema
const LocationSchema: Schema<ILocationDetails> = new Schema<ILocationDetails>({
  country: { type: CountrySchema, required: true },
  state: {
    type: StateSchema,
    required: true,
  },
  city: {
    type: CitySchema,
    required: true,
  },
});

// Define HostelDetails Schema
const HostelDetailsSchema: Schema<IHostelDetailsDetails> =
  new Schema<IHostelDetailsDetails>({
    hostelType: {
      type: String,
      enum: Object.values(HostelTypes),
      required: true,
    },
    noOfBuildings: { type: Number, required: true },
    noOfBeds: { type: Number, required: true },
  });

// Define College Schema
const UniversitySchema: Schema<ICollege> = new Schema<ICollege>(
  {
    totalCapacity: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    address: {
      type: String,
      required: true,
    },
    googleMapLink: {
      type: String,
      required: true,
    },
    location: {
      type: LocationSchema,
      required: true,
    },
    courseIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    hostelDetails: {
      type: [HostelDetailsSchema],
      required: true,
    },
    roomTypes: {
      type: [String],
      enum: Object.values(RoomTypes),
      required: true,
    },
    paymentTypes: {
      type: [String],
      enum: Object.values(BillingCycleTypes),
      required: true,
    },
    mealTypes: {
      type: [String],
      enum: Object.values(MealTypes),
      required: true,
    },
    evChargingStation: {
      type: Number,
      required: true,
    },
    parkingSpaces: {
      type: Number,
      required: true,
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

// Add Indexes
UniversitySchema.index({ name: 1 }, { unique: true });
UniversitySchema.index({ status: 1 });
UniversitySchema.index({
  "location.city.cityId": 1,
  "location.state.stateId": 1,
});
UniversitySchema.index({ createdBy: 1 });
UniversitySchema.index({ updatedBy: 1 }, { sparse: true });
UniversitySchema.index({ "hostelDetails.hostelType": 1 });
UniversitySchema.index({ roomTypes: 1 });
UniversitySchema.index({ paymentTypes: 1 });
UniversitySchema.index({ mealTypes: 1 });
UniversitySchema.index({ name: "text" });

// Create the Model
const College = mongoose.model<ICollege>("College", UniversitySchema);

export default College;
