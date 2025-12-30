import mongoose from "mongoose";
import { VALIDATION_MESSAGES } from "./messages";

const { INVALID_ID } = VALIDATION_MESSAGES;

/**
 * Validates if a given ID is a valid MongoDB ObjectId
 * @param id ID to validate
 * @throws Error if ID is invalid
 */
export const validateObjectId = (id: string): void => {
    if (!mongoose.isValidObjectId(id)) {
        throw new Error(INVALID_ID);
    }
};

/**
 * Validates multiple IDs are valid MongoDB ObjectIds
 * @param ids Array of IDs to validate
 * @throws Error if any ID is invalid
 */
export const validateObjectIds = (ids: string[]): void => {
    for (const id of ids) {
        validateObjectId(id);
    }
};
