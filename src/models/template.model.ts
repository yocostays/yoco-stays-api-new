import { Document, Schema, model } from "mongoose";
import { TemplateTypes } from "../utils/enum";

//Define template interface
export interface ITemplate extends Document {
  hostelId: Schema.Types.ObjectId;
  title: string;
  description: string;
  image: string;
  status: boolean;
  templateType: TemplateTypes;
  createdBy: Schema.Types.ObjectId;
  updatedBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

//Define temaplate schema
const TemplateSchema: Schema = new Schema<ITemplate>(
  {
    hostelId: {
      type: Schema.Types.ObjectId,
      ref: "Hostel",
      required: false,
      default: null,
    },
    title: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      index: true,
    },
    image: {
      type: String,
      required: false,
      default: null,
    },
    status: {
      type: Boolean,
      default: true,
      index: true,
    },
    templateType: {
      type: String,
      enum: Object.values(TemplateTypes),
      required: true,
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

//Add compound indexing with hostelId and templateType
TemplateSchema.index({ hostelId: 1, templateType: 1 });

const Template = model<ITemplate>("Template", TemplateSchema);

export default Template;
