import mongoose, { Document, Schema } from "mongoose";
import { VALIDATION_MESSAGES } from "../utils/messages";
import {
  BloodGroupType,
  Gender,
  VechicleTypes,
  VehicleEngineTypes,
} from "../utils/enum";
const { INVALID_EMAIL } = VALIDATION_MESSAGES;

// Define the VehicleDetails Schema
export interface IVehicleDetails extends Document {
  vechicleType: VechicleTypes;
  engineType: VehicleEngineTypes;
  vechicleNumber: string;
  modelName: string;
}

export interface IKycDocumentDetails extends Document {
  aadhaarCard: string;
  drivingLicense: string;
  panCard: string;
  passport: string;
  voterCard: string;
}

export interface IHostelDetails extends Document {
  hostelId: mongoose.Types.ObjectId;
  floorNumber: number[];
  roomNumber: number[];
}

// Define the HostelDetails Schema
const HostelDetails: Schema<IHostelDetails> = new Schema<IHostelDetails>({
  hostelId: {
    type: Schema.Types.ObjectId,
    ref: "Hostel",
    required: true,
  },
  floorNumber: {
    type: [Number],
    required: false,
    default: [],
  },
  roomNumber: {
    type: [Number],
    required: false,
    default: [],
  },
});

// Define the KycDocumentDetails Schema
const KycDocumentDetails: Schema<IKycDocumentDetails> =
  new Schema<IKycDocumentDetails>({
    aadhaarCard: {
      type: String,
      required: false,
      default: null,
    },
    passport: {
      type: String,
      required: false,
      default: null,
    },
    voterCard: {
      type: String,
      required: false,
      default: null,
    },
    drivingLicense: {
      type: String,
      required: false,
      default: null,
    },
    panCard: {
      type: String,
      required: false,
      default: null,
    },
  });

// Define the VehicleDetails Schema
const VehicleDetailsSchema: Schema<IVehicleDetails> =
  new Schema<IVehicleDetails>({
    vechicleType: {
      type: String,
      enum: Object.values(VechicleTypes),
      required: true,
    },
    engineType: {
      type: String,
      enum: Object.values(VehicleEngineTypes),
      default: VehicleEngineTypes.NOT_REQUIRED,
    },
    vechicleNumber: {
      type: String,
      required: false,
      default: null,
    },
    modelName: {
      type: String,
      required: true,
    },
  });

// Define the Staff interface
export interface IStaff extends Document {
  roleId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  userName: string;
  name: string;
  image: string;
  phone: number;
  email: string;
  dob: Date;
  joiningDate: Date;
  bloodGroup: BloodGroupType;
  gender: Gender;
  password: string;
  fatherName: string;
  motherName: string;
  spouseName: string;
  hostelIds: mongoose.Types.ObjectId[];
  floorNumber: number[];
  roomNumber: number[];
  shiftStartTime: string;
  shiftEndTime: string;
  vechicleDetails: IVehicleDetails[];
  hostelDetails: IHostelDetails[];
  kycDocuments: IKycDocumentDetails;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Define the Staff schema
const StaffSchema: Schema = new Schema<IStaff>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    image: {
      type: String,
      required: false,
      default: null,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, INVALID_EMAIL],
    },
    phone: {
      type: Number,
      required: true,
      unique: true,
    },
    dob: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      enum: Object.values(Gender),
      required: true,
    },
    bloodGroup: {
      type: String,
      enum: Object.values(BloodGroupType),
      required: false,
      default: null,
    },
    password: {
      type: String,
      required: true,
    },
    roleId: {
      type: Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "ComplainCategory",
      required: false,
      default: null,
    },
    hostelIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Hostel",
        default: null,
      },
    ],
    hostelDetails: {
      type: [HostelDetails], //TODO - add hostel details for complaint
      required: false,
      default: [],
    },
    vechicleDetails: {
      type: [VehicleDetailsSchema],
      required: false,
      default: [],
    },
    kycDocuments: {
      type: KycDocumentDetails,
      required: false,
      default: {},
    },
    joiningDate: {
      type: Date,
      required: false,
      default: null,
    },
    fatherName: {
      type: String,
      required: false,
      default: null,
    },
    motherName: {
      type: String,
      required: false,
      default: null,
    },
    spouseName: {
      type: String,
      required: false,
      default: null,
    },
    shiftStartTime: {
      type: String,
      required: false,
      default: null,
    },
    shiftEndTime: {
      type: String,
      required: false,
      default: null,
    },
    status: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index for filtering fields: email, phone, roleId, hostelIds, status, uniqueId
StaffSchema.index(
  { email: 1, phone: 1, roleId: 1, hostelIds: 1, status: 1, uniqueId: 1 },
  { name: "filter_index" }
);

// Index for sorting by createdAt and updatedAt
StaffSchema.index({ createdAt: -1, updatedAt: -1 }, { name: "sort_index" });

// Unique indexes for email, phone, and userName
StaffSchema.index({ email: 1 }, { unique: true });
StaffSchema.index({ phone: 1 }, { unique: true });
StaffSchema.index({ userName: 1 }, { unique: true });

const Staff = mongoose.model<IStaff>("Staff", StaffSchema);
export default Staff;
