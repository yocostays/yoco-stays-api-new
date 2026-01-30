import { Response } from "express";
import { HttpResponse } from "./httpResponse";

// Sends a standardized success response

export const sendSuccess = (
  res: Response,
  message: string,
  data?: any,
  statusCode: number = 200,
  count?: number
): Response<HttpResponse> => {
  const response: HttpResponse = {
    statusCode,
    message,
    ...(count !== undefined && { count }),
    ...(data !== undefined && { data }),
  };
  return res.status(statusCode).json(response);
};

// Sends a standardized error response

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 400
): Response<HttpResponse> => {
  const response: HttpResponse = {
    statusCode,
    message,
  };
  return res.status(statusCode).json(response);
};

// Handles Zod validation errors and sends formatted error response
export const sendZodError = (
  res: Response,
  parseResult: any
): Response<HttpResponse> | null => {
  if (parseResult.success) {
    return null; // No error, validation passed
  }

  const errors = parseResult.error.issues
    .map((e: { message: string }) => e.message)
    .join(", ");

  return sendError(res, `Zod validation error: ${errors}`, 400);
};
