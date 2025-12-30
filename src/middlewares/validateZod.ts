import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export const validateZod =
  (schema: ZodSchema, source: "body" | "query" = "body") => (req: Request, res: Response, next: NextFunction) => {
    try {
      if (source === "body") {
        req.body = schema.parse(req.body);
      } else {
        req.query = schema.parse(req.query) as any;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          statusCode: 400,
          message: err.issues.map((e) => e.message).join(", "),
        });
      }

      return res.status(400).json({
        statusCode: 400,
        message: "Invalid request data",
      });
    }
  };
