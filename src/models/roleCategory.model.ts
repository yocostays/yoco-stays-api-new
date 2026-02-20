import mongoose, { Document, Schema } from "mongoose";

// Define the RoleCategory interface
export interface IRoleCategory extends Document {
  categoryType: string;
  status: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const RoleCategorySchema: Schema = new Schema<IRoleCategory>(
  {
    categoryType: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: false,
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: false,
      default: null,
    },
  },
  { timestamps: true },
);

// Create unique index on categoryType with case-insensitive collation to avoid duplicates at database level
RoleCategorySchema.index(
  { categoryType: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

const RoleCategory = mongoose.model<IRoleCategory>(
  "RoleCategory",
  RoleCategorySchema,
);
export default RoleCategory;
