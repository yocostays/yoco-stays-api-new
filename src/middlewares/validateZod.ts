import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export const validateZod =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          statusCode: 400,
          message: err.issues.map((e) => e.message).join(", "),
        });
      }

      // fallback – should rarely happen
      return res.status(400).json({
        statusCode: 400,
        message: "Invalid request data",
      });
    }
  };
