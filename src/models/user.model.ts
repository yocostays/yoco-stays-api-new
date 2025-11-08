import mongoose, { Document, Schema } from "mongoose";
import { VALIDATION_MESSAGES } from "../utils/messages";
import {
  Gender,
  BloodGroupType,
  VechicleTypes,
  VehicleEngineTypes,
  CategoryTypes,
} from "../utils/enum";

const { INVALID_EMAIL } = VALIDATION_MESSAGES;

export interface IVechicleDetails extends Document {
  vechicleType: VechicleTypes;
  engineType: VehicleEngineTypes;
  vechicleNumber: string;
  modelName: string;
}

export interface IKycDocumentDetails extends Document {
  aadhaarCard: string;
  voterCard: string;
  passport: string;
  drivingLicense: string;
  panCard: string;
  aadhaarNumber: string;
}

// Define CountryDetails Interface
export interface ICountryDetails extends Document {
  countryId: number;
  name: string;
  iso2: string;
}

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

export interface IFamiliyDetails extends Document {
  // parentsContactNo: number;
  fatherName: string;
  fatherNumber: number;
  fatherEmail: string;
  fatherOccuption: string;
  motherName: string;
  motherNumber: number;
  motherEmail: string;
  guardianName: string;
  guardianContactNo: number;
  relationship: string;
  occuption: string;
  guardianEmail: string;
  address: string;
}

export interface IAcademicDetails extends Document {
  universityId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  academicYear: string;
  semester: number;
}

// Define the user interface
export interface IUser extends Document {
  uniqueId: string;
  nationality: string | null;
  bulkState: string | null;
  bulkCity: string | null;
  roleId: mongoose.Types.ObjectId;
  name: string;
  image: string;
  password: string;
  phone: number;
  email: string | null;
  dob: Date | null;
  enrollmentNumber: string;
  bloodGroup: BloodGroupType;
  divyang: boolean;
  gender: Gender;
  identificationMark: string;
  medicalIssue: string;
  allergyProblem: string;
  country: ICountryDetails;
  state: IStateDetails;
  city: ICityDetails;
  category: CategoryTypes;
  cast: string;
  permanentAddress: string;
  currentAddress: string;
  familiyDetails: IFamiliyDetails;
  academicDetails: IAcademicDetails;
  documents: IKycDocumentDetails;
  hostelId: mongoose.Types.ObjectId;
  vechicleDetails: IVechicleDetails[];
  indisciplinaryAction: boolean;
  isVerified: boolean;
  isAuthorized: boolean;
  authorizRole: string;
  verifiedBy: mongoose.Types.ObjectId;
  oneSignalWebId: string;
  oneSignalAndoridId: string;
  oneSignalIosId: string;
  lastLogin: Date;
  isLeft: boolean;
  leftDate: Date;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Define Country Schema
const CountrySchema: Schema<ICountryDetails> = new Schema<ICountryDetails>({
  countryId: { type: Number, required: true },
  name: { type: String, required: true },
  iso2: { type: String, required: true },
});

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

// Define the VechicleDetails Schema
const VechicleDetailsSchema: Schema<IVechicleDetails> =
  new Schema<IVechicleDetails>({
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

// Define the Documnet Schema
const KycDocumentDetails: Schema<IKycDocumentDetails> =
  new Schema<IKycDocumentDetails>({
    aadhaarNumber: {
      type: String,
      required: false,
      default: null
    },
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

// Define the Academic Schema
const AcademicDetailsSchema: Schema<IAcademicDetails> =
  new Schema<IAcademicDetails>({
    universityId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "College",
    },
    courseId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Course",
    },
    academicYear: {
      type: String,
      required: true,
    },
    semester: {
      type: Number,
      required: true,
    },
  });

// Define the Familiy Schema
const FamilyDetailsSchema: Schema<IFamiliyDetails> =
  new Schema<IFamiliyDetails>({
    fatherName: {
      type: String,
      required: true,
    },
    fatherNumber: {
      type: Number,
      required: false,
      default: null
    },
    fatherEmail: {
      type: String,
      required: false,
      default: null,
    },
    fatherOccuption: {
      type: String,
      required: false,
      default: null,
    },
    motherName: {
      type: String,
      required: true,
    },
    motherNumber: {
      type: Number,
      required: false,
      default: null,
    },
    motherEmail: {
      type: String,
      required: false,
      default: null,
    },
    guardianName: {
      type: String,
      required: false,
      default: null,
    },
    guardianContactNo: {
      type: Number,
      required: false,
      default: null,
    },
    relationship: {
      type: String,
      required: false,
      default: null,
    },
    occuption: {
      type: String,
      required: false,
      default: null,
    },
    guardianEmail: {
      type: String,
      required: false,
      default: null,
    },
    address: {
      type: String,
      required: false,
      default: null,
    },
    // parentsContactNo: {
    //   type: Number,
    //   required: true,
    // },
  });

// Define the User Schema
const UserSchema: Schema<IUser> = new Schema<IUser>(
  {
    uniqueId: {
      type: String,
      required: false,
      default: null,
    },
    roleId: {
      type: Schema.Types.ObjectId,
      ref: "Role",
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: false,
      default: null,
    },
    password: {
      type: String,
      required: false,
      default: null,
    },
    phone: {
      type: Number,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, INVALID_EMAIL],
    },
    dob: {
      type: Date,
      required: false,
    },
    enrollmentNumber: {
      type: String,
      required: false,
      unique: true,
    },
    bloodGroup: {
      type: String,
      // enum: Object.values(BloodGroupType),
      required: false,
      default:null
    },
    divyang: {
      type: Boolean,
      default: false,
    },
    gender: {
      type: String,
      enum: Object.values(Gender),
      required: true,
      default: Gender.NOT_SELECTED,
    },
    identificationMark: {
      type: String,
      required: false,
      default: null,
    },
    medicalIssue: {
      type: String,
      required: false,
      default: null,
    },
    allergyProblem: {
      type: String,
      required: false,
      default: null,
    },
    country: { type: CountrySchema, required: false, default: null },
    nationality: {
      type: String,
      requried: false
    },
    state: {
      type: StateSchema,
      required: false,
      default: null,
    },
    bulkState: {
      type: String,
      requried: false
    },
    city: {
      type: CitySchema,
      required: false,
      default: null,
    },
    bulkCity: {
      type: String,
      requried: false
    },
    category: {
      type: String,
      enum: Object.values(CategoryTypes),
      required: false,
      default: CategoryTypes.NOT_SELECTED,
    },
    cast: {
      type: String,
      required: false,
      default: null,
    },
    permanentAddress: {
      type: String,
      required: false,
      default: null,
    },
    currentAddress: {
      type: String,
      required: false,
      default: null,
    },
    familiyDetails: {
      type: FamilyDetailsSchema,
      required: false,
    },
    academicDetails: {
      type: AcademicDetailsSchema,
      required: false,
    },
    documents: {
      type: KycDocumentDetails,
      required: false,
      default: {},
    },
    hostelId: {
      type: Schema.Types.ObjectId,
      ref: "Hostel",
      required: false,
    },

    vechicleDetails: {
      type: [VechicleDetailsSchema],
      required: false,
      default: [],
    },
    indisciplinaryAction: {
      type: Boolean,
      default: false,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },
    isAuthorized: {
      type: Boolean,
      default: false,
    },
    authorizRole: {
      type: String,
      required: false,
      default: null,
    },
    oneSignalWebId: {
      type: String,
      required: false,
      default: null,
    },
    oneSignalAndoridId: {
      type: String,
      required: false,
      default: null,
    },
    oneSignalIosId: {
      type: String,
      required: false,
      default: null,
    },
    lastLogin: {
      type: Date,
      required: false,
      default: null,
    },
    isLeft: {
      type: Boolean,
      default: false,
    },
    leftDate: {
      type: Date,
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

const User = mongoose.model<IUser>("User", UserSchema);
export default User;
