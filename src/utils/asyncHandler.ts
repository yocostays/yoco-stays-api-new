import { Request, Response, NextFunction } from "express";
import { ERROR_MESSAGES } from "./messages";
import { sendError } from "./responseHelpers";

const { SERVER_ERROR } = ERROR_MESSAGES;

//Higher-order function that wraps controller methods with try-catch error handling

export const asyncHandler = (
    fn: (req: Request, res: Response, next?: NextFunction) => Promise<any>
) => {
    return async (req: Request, res: Response, next?: NextFunction): Promise<any> => {
        try {
            return await fn(req, res, next);
        } catch (error: any) {
            const errorMessage = error.message ?? SERVER_ERROR;
            const statusCode = error.statusCode ?? 500;
            return sendError(res, errorMessage, statusCode);
        }
    };
};
