import mongoose from "mongoose";
import {
  VALIDATION_MESSAGES,
} from "./messages";

const { REQUIRED_FIELD, INVALID_ID } = VALIDATION_MESSAGES;
// Function to validate required fields
export const validateRequiredField = (
  field: any,
  fieldName: string
): string | null => {
  if (!field || (typeof field === "string" && field.trim() === "")) {
    return REQUIRED_FIELD(fieldName);
  }
  return null;
};

// Function to validate MongoDB ObjectId
export const validateObjectId = (id: any, fieldName: string): string | null => {
  return mongoose.isValidObjectId(id) ? null : INVALID_ID;
};

// Function to validate arrays
export const validateArray = (array: any, fieldName: string): string | null => {
  return Array.isArray(array) && array.length > 0
    ? null
    : REQUIRED_FIELD(fieldName);
};

// Function to validate numbers
export const validateNumber = (
  value: any,
  fieldName: string
): string | null => {
  return typeof value === "number" && value >= 0
    ? null
    : REQUIRED_FIELD(fieldName);
};

// Function to validate location objects
export const validateLocation = (location: any): string | null => {
  return location?.state && location?.city && location?.country
    ? null
    : REQUIRED_FIELD("location");
};
