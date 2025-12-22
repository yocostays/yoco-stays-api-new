import { Document, Schema, model, Types } from "mongoose";

export interface ISubcategory {
  _id?: Types.ObjectId;
  title: string;
  slug: string;
  description?: string;

  // Notification Template Support for Mobile Push Notifications
  notificationTemplate?: {
    heading: string;
    body: string;
    imageUrl?: string;
    actionData?: any;
    channels?: string[];
  };

  meta?: {
    order?: number;
    visibleTo?: string[];
    priority?: string;
    defaultTemplateId?: string;
    templateType?: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGlobalTemplate extends Document {
  title: string;
  slug: string;
  description?: string;
  scope: "global" | "hostel";
  hostelId?: Types.ObjectId | null;
  subcategories: ISubcategory[];
  isActive: boolean;
  isDeleted: boolean;
  version: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubcategorySchema = new Schema<ISubcategory>({
  title: { type: String, required: true, maxlength: 150 },
  slug: { type: String, required: true, maxlength: 60 },
  description: { type: String, maxlength: 500 },

  // Notification Template Fields
  notificationTemplate: {
    heading: { type: String, maxlength: 200 },
    body: { type: String, maxlength: 1000 },
    imageUrl: { type: String },
    actionData: { type: Schema.Types.Mixed },
    channels: [{ type: String, enum: ["push", "sms", "email"] }],
  },

  meta: {
    order: { type: Number },
    visibleTo: [{ type: String }],
    priority: { type: String },
    defaultTemplateId: { type: String },
    templateType: { type: String },
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const GlobalTemplateSchema = new Schema<IGlobalTemplate>(
  {
    title: { type: String, required: true, maxlength: 150 },
    slug: {
      type: String,
      required: true,
      maxlength: 60,
    },
    description: { type: String, maxlength: 1000 },
    scope: { type: String, enum: ["global", "hostel"], default: "global" },
    hostelId: { type: Schema.Types.ObjectId, default: null, ref: "Hostel" },
    subcategories: { type: [SubcategorySchema], default: [] },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    version: { type: Number, default: 1 },
    createdBy: { type: String, default: "system" },
    updatedBy: { type: String, default: null },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

// Partial Unique Index: unique slug per scope/hostel ONLY if not deleted
GlobalTemplateSchema.index(
  { slug: 1, scope: 1, hostelId: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
    background: true,
    name: "ux_category_scope_slug",
  }
);

// Partial Unique Index: unique TITLE per scope/hostel ONLY if not deleted
GlobalTemplateSchema.index(
  { title: 1, scope: 1, hostelId: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
    background: true,
    name: "ux_category_scope_title",
  }
);

// Performance Index: Fast lookup by templateType for notifications
GlobalTemplateSchema.index(
  { "subcategories.meta.templateType": 1, scope: 1, isActive: 1, isDeleted: 1 },
  {
    background: true,
    name: "idx_notification_template_lookup",
  }
);

const GlobalTemplate = model<IGlobalTemplate>(
  "GlobalTemplate",
  GlobalTemplateSchema
);

export default GlobalTemplate;
