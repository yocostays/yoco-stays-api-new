import mongoose, { Document, Schema } from "mongoose";
import { AccountType } from "../utils/enum";

// Define the Token interface
export interface IToken extends Document {
  accountType: AccountType;
  userId: mongoose.Types.ObjectId;
  token: string;
  expiryTime: Date;
  status: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const TokenSchema: Schema = new Schema<IToken>(
  {
    accountType: {
      type: String,
      enum: Object.values(AccountType),
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    expiryTime: {
      type: Date,
      required: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Token = mongoose.model<IToken>("Token", TokenSchema);
export default Token;
