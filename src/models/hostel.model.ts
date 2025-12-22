import mongoose, { Document, Schema } from "mongoose";
import {
  RoomMaintenanceStatusType,
  RoomTypes,
  WeekDaysTypes,
  OccupancyTypes,
  WashroomTypes,
  MealTypes,
  DietaryOptionsTypes,
  MealCountReportType,
  RoomCoolingType,
} from "../utils/enum";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

// Interfaces
export interface IBedNumberDetails extends Document {
  bedNumber: string;
  isVacant: boolean;
}

export interface IRoomDetails extends Document {
  bedType: number;
  roomNumber: number;
  floorNumber: number;
  totalBeds: number;
  bedNumbers: IBedNumberDetails[];
  maintenanceStatus: RoomMaintenanceStatusType;
  roomType: RoomCoolingType;
  occupancyType: OccupancyTypes;
  washroomType: WashroomTypes;
  vacant: number;
  occupied: number;
  isAssignedToStaff: boolean;
}

export interface IImageDetails extends Document {
  url: string;
}

export interface IBedDetails extends Document {
  bedType: number;
  numberOfRooms: number;
  totalBeds: number;
  accommodationFee: number;
}

export interface IVisitingHours extends Document {
  day: WeekDaysTypes;
  isVisitorAllowed: boolean;
  startTime: string;
  endTime: string;
}

export interface IEmergencyNumber extends Document {
  wardenNumber: number;
  securityGuardNumber: number;
  medicalNumber: number;
  otherNumber: number;
}

export interface ISecurityDetails extends Document {
  numberOfGuards: number;
  availablity: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface ILegalDocuments extends Document {
  conductPdf: string;
  refundPolicy: string;
  allocationRule: string;
}

export interface IDiningDetails extends Document {
  name: MealCountReportType;
  startTime: string;
  endTime: string;
}

export interface IMessDetails extends Document {
  messAvailability: boolean;
  mealType: MealTypes;
  specialDietary: boolean;
  dietaryOptions: DietaryOptionsTypes[];
  diningTimeSlot: IDiningDetails[];
}

export interface IHostel extends Document {
  universityId: mongoose.Types.ObjectId;
  name: string;
  identifier: string;
  buildingNumber: string;
  address: string;
  description: string;
  image: IImageDetails[];
  securityFee: number;
  amenitieIds: mongoose.Types.ObjectId[];
  isAgreementRequired: boolean;
  visitingHours: IVisitingHours[];
  emergencyNumbers: IEmergencyNumber;
  securityDetails: ISecurityDetails;
  bedDetails: IBedDetails[];
  roomMapping: IRoomDetails[];
  legalDocuments: ILegalDocuments;
  messDetails: IMessDetails;
  totalFloor: number;
  totalRoom: number;
  totalCapacity: number;
  totalBed: number;
  status: boolean;
  wardenIds: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

// Sub-Schemas
const ImageSchema: Schema<IImageDetails> = new Schema({
  url: { type: String, required: true },
});

const BedNumberDetailsSchema: Schema<IBedNumberDetails> = new Schema({
  bedNumber: { type: String, trim: true, required: true },
  isVacant: { type: Boolean, default: true },
});

const RoomMappingSchema: Schema<IRoomDetails> = new Schema({
  bedType: { type: Number, enum: [1, 2, 3, 4], required: true },
  roomNumber: { type: Number, required: true },
  floorNumber: { type: Number, required: true },
  totalBeds: { type: Number, required: true },
  bedNumbers: { type: [BedNumberDetailsSchema], required: true },
  vacant: { type: Number, required: true },
  occupied: { type: Number, required: true },
  maintenanceStatus: {
    type: String,
    enum: Object.values(RoomMaintenanceStatusType),
    required: true,
    default: RoomMaintenanceStatusType.NOT_REQUIRED,
  },
  roomType: {
    type: String,
    enum: Object.values(RoomCoolingType),
    required: true,
  },
  occupancyType: {
    type: String,
    enum: Object.values(OccupancyTypes),
    required: true,
  },
  washroomType: {
    type: String,
    enum: Object.values(WashroomTypes),
    required: true,
  },
  isAssignedToStaff: { type: Boolean, default: false },
});

const BedDetailsSchema: Schema<IBedDetails> = new Schema({
  bedType: { type: Number, enum: [1, 2, 3, 4], required: true },
  numberOfRooms: { type: Number, required: true },
  totalBeds: { type: Number, required: true },
  accommodationFee: { type: Number, required: true },
});

const VisitingHoursSchema: Schema<IVisitingHours> = new Schema({
  day: { type: String, enum: Object.values(WeekDaysTypes), required: true },
  isVisitorAllowed: { type: Boolean, required: true },
  startTime: { type: String, required: false, default: null },
  endTime: { type: String, required: false, default: null },
});

const EmergencyNumberSchema: Schema<IEmergencyNumber> = new Schema({
  wardenNumber: { type: Number, required: false, default: null },
  securityGuardNumber: { type: Number, required: false, default: null },
  medicalNumber: { type: Number, required: false, default: null },
  otherNumber: { type: Number, required: false, default: null },
});

const SecurityDetailsSchema: Schema<ISecurityDetails> = new Schema({
  numberOfGuards: { type: Number, required: true },
  availablity: { type: Boolean, required: true },
  startTime: { type: String, required: false, default: null },
  endTime: { type: String, required: false, default: null },
});

const LegalDocumentsSchema: Schema<ILegalDocuments> = new Schema({
  conductPdf: { type: String, required: true },
  refundPolicy: { type: String, required: true },
  allocationRule: { type: String, required: true },
});

const DiningDetailsSchema: Schema<IDiningDetails> = new Schema({
  name: {
    type: String,
    enum: Object.values(MealCountReportType),
    required: true,
  },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
});

const MessDetailsSchema: Schema<IMessDetails> = new Schema({
  messAvailability: { type: Boolean, required: true },
  mealType: { type: String, enum: Object.values(MealTypes), required: true },
  specialDietary: { type: Boolean, required: true },
  dietaryOptions: {
    type: [String],
    enum: Object.values(DietaryOptionsTypes),
    required: false,
  },
  diningTimeSlot: { type: [DiningDetailsSchema], required: true },
});

// Main Schema
const HostelSchema: Schema<IHostel> = new Schema<IHostel>(
  {
    universityId: {
      type: Schema.Types.ObjectId,
      ref: "College",
      required: true,
      index: true, // Index for fast lookups by universityId
    },
    name: { type: String, required: true, trim: true, unique: true },
    identifier: { type: String, required: true, unique: true },
    buildingNumber: { type: String, required: true },
    address: { type: String, required: true },
    image: { type: [ImageSchema], required: true },
    description: { type: String, required: true },
    bedDetails: { type: [BedDetailsSchema], required: true },
    roomMapping: { type: [RoomMappingSchema], default: null },
    securityFee: { type: Number, required: true },
    amenitieIds: {
      type: [Schema.Types.ObjectId],
      ref: "Amenities",
      required: true,
      index: true, // Index for queries involving amenitieIds
    },
    isAgreementRequired: { type: Boolean, default: false },
    visitingHours: { type: [VisitingHoursSchema], required: true },
    emergencyNumbers: {
      type: EmergencyNumberSchema,
      required: false,
      default: null,
    },
    securityDetails: { type: SecurityDetailsSchema, required: true },
    legalDocuments: {
      type: LegalDocumentsSchema,
      required: false,
      default: null,
    },
    messDetails: { type: MessDetailsSchema, required: false, default: null },
    totalCapacity: { type: Number, required: true, default: 0 },
    totalFloor: { type: Number, required: true, default: 0 },
    totalRoom: { type: Number, required: true, default: 0 },
    totalBed: { type: Number, required: true, default: 0 },
    status: { type: Boolean, default: true, index: true },
    wardenIds: { type: [Schema.Types.ObjectId], ref: "Staff", index: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
      index: true,
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

// Compound index for frequent queries involving universityId and status
HostelSchema.index({ universityId: 1, status: 1 });

// Text index for full-text search on name and description
HostelSchema.index({ name: "text", description: "text" });

// Index for efficient sorting by createdAt or updatedAt
HostelSchema.index({ createdAt: -1 });
HostelSchema.index({ updatedAt: -1 });


HostelSchema.plugin(aggregatePaginate);

interface HostelModel<T extends Document> extends mongoose.AggregatePaginateModel<T> { }

const Hostel: HostelModel<IHostel> = mongoose.model<IHostel>("Hostel", HostelSchema) as HostelModel<IHostel>;
export default Hostel;
