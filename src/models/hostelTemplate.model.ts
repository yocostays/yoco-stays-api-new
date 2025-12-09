import { Document, Schema, model, Types } from "mongoose";

export interface IHostelSubcategory {
  title: string;
  slug: string; // Copied from original or custom
  description?: string;
  isActive: boolean;
  // Snapshot of original ID for reference if needed, or just new ID
  originalSubcategoryId?: Types.ObjectId; 
  _id?: Types.ObjectId; 
}

export interface IHostelTemplate extends Document {
  hostelId: Types.ObjectId;
  globalTemplateId: Types.ObjectId; // Reference to canonical category
  title: string; // Snapshot
  slug: string; // Snapshot
  description?: string;
  hostelName?: string;
  hostelCode?: string;
  subcategories: IHostelSubcategory[];
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HostelSubcategorySchema = new Schema<IHostelSubcategory>({
  title: { type: String, required: true },
  slug: { type: String, required: true },
  description: { type: String },
  isActive: { type: Boolean, default: true },
  originalSubcategoryId: { type: Schema.Types.ObjectId },
});

const HostelTemplateSchema = new Schema<IHostelTemplate>(
  {
    hostelId: { type: Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
    globalTemplateId: { type: Schema.Types.ObjectId, ref: "GlobalTemplate", required: true },
    title: { type: String, required: true },
    slug: { type: String, required: true }, // Keep slug for consistency
    description: { type: String },
    hostelName: { type: String },
    hostelCode: { type: String },
    subcategories: { type: [HostelSubcategorySchema], default: [] },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

// Compound Index: Ensure a global template is only mapped once per hostel
HostelTemplateSchema.index({ hostelId: 1, globalTemplateId: 1 }, { unique: true });

// Additional indexes for query optimization
HostelTemplateSchema.index({ hostelId: 1 });
HostelTemplateSchema.index({ globalTemplateId: 1 });
HostelTemplateSchema.index({ createdAt: -1 });
HostelTemplateSchema.index({ isDeleted: 1 });

export const HostelTemplate = model<IHostelTemplate>("HostelTemplate", HostelTemplateSchema);
export default HostelTemplate;
