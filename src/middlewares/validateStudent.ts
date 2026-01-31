import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/responseHelpers";
import { AccountType } from "../utils/enum";

// Middleware to ensure the authenticated user is a student
export const validateStudent = (req: Request, res: Response, next: NextFunction) => {
    const userType = req.body._valid?.userType;

    if (userType !== AccountType.STUDENT) {
        return sendError(res, "Access denied. Student access required", 403);
    }

    next();
};
