import { Request, Response, NextFunction } from "express";

const requestTracker = new Map<string, number[]>();

// Cleanup interval: 1 minute (to prevent memory leaks for inactive students)
setInterval(() => {
  const now = Date.now();
  for (const [studentId, timestamps] of requestTracker.entries()) {
    // Keep only timestamps from the last 60 seconds
    const validTimestamps = timestamps.filter((ts) => now - ts < 60000);
    if (validTimestamps.length === 0) {
      requestTracker.delete(studentId);
    } else {
      requestTracker.set(studentId, validTimestamps);
    }
  }
}, 60000);

export const studentMealBookingRateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const studentId = (req as any).user?._id || (req as any).user?.id;

  if (!studentId) {
    return next();
  }

  const now = Date.now();
  const windowMs = 60000;
  const maxAttempts = 3;

  let timestamps = requestTracker.get(studentId) || [];

  timestamps = timestamps.filter((ts) => now - ts < windowMs);

  if (timestamps.length >= maxAttempts) {
    return res.status(429).json({
      statusCode: 429,
      message: "Too many booking attempts. Please try again later.",
    });
  }

  timestamps.push(now);
  requestTracker.set(studentId, timestamps);

  next();
};
