import mongoose, { Schema, Document } from "mongoose";

export interface IEmailQueue extends Document {
  email: string;
  name: string;
  uniqueId: string;
  plainPassword: string;
  status: "pending" | "processing" | "sent" | "failed" | "permanent_failed";
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  nextAttempt: Date;
  processingAt?: Date;
  processingBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmailQueueSchema: Schema = new Schema(
  {
    email: { type: String, required: true },
    name: { type: String, required: true },
    uniqueId: { type: String, required: true },
    plainPassword: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "sent", "failed", "permanent_failed"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    lastError: { type: String },
    nextAttempt: { type: Date, default: Date.now, index: true },
    processingAt: { type: Date }, // For lease management
    processingBy: { type: String }, // Worker ID
  },
  { timestamps: true }
);

// Compound indexes for efficient querying
EmailQueueSchema.index({ status: 1, nextAttempt: 1 });
EmailQueueSchema.index({ processingAt: 1 }); // To find stuck jobs
EmailQueueSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // Auto-delete after 30 days

const EmailQueue = mongoose.model<IEmailQueue>("EmailQueue", EmailQueueSchema);
export default EmailQueue;
