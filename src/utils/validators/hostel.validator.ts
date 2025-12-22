import Joi from "joi";

export const uploadRoomMappingSchema = Joi.object({
    roomNumber: Joi.number().required().messages({
        "number.base": "RoomNumber must be a number",
        "any.required": "RoomNumber header is missing or value is empty",
    }),
    floorNumber: Joi.number().required().messages({
        "number.base": "FloorNumber must be a number",
        "any.required": "FloorNumber header is missing or value is empty",
    }),
    bedType: Joi.string()
        .trim()
        .valid("single", "double", "triplet", "quadrille")
        .insensitive()
        .required()
        .messages({
            "any.only": "Bed Type must be one of: Single, Double, Triplet, Quadrille",
            "string.base": "Bed Type must be a text value",
            "any.required": "Bed Type header is missing or value is empty",
        }),
    bedNumbers: Joi.string().required().messages({
        "any.required": "BedNumbers header is missing or value is empty",
        "string.base": "BedNumbers must be a string",
        "string.empty": "BedNumbers cannot be empty",
    }),
    maintenanceStatus: Joi.string().required().messages({
        "any.required": "MaintenanceStatus header is missing or value is empty",
        "string.base": "MaintenanceStatus must be a string",
        "string.empty": "MaintenanceStatus cannot be empty",
    }),
    roomType: Joi.string().required().messages({
        "any.required": "RoomType header is missing or value is empty",
        "string.base": "RoomType must be a string",
        "string.empty": "RoomType cannot be empty",
    }),
    occupancyType: Joi.string().required().messages({
        "any.required": "OccupancyType header is missing or value is empty",
        "string.base": "OccupancyType must be a string",
        "string.empty": "OccupancyType cannot be empty",
    }),
    washroomType: Joi.string().required().messages({
        "any.required": "WashroomType header is missing or value is empty",
        "string.base": "WashroomType must be a string",
        "string.empty": "WashroomType cannot be empty",
    }),
});
