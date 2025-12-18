import rateLimit from "express-rate-limit";
import { Request } from "express";

const keyGenerator = (req: Request): string => {
  return (
    req.body.email ||
    req.body.phone ||
    req.body.identifier ||
    req.ip ||
    "unknown"
  );
};

// 3 requests per 1 minutes
export const otpShortTermLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 3,
  message: "Too many OTP requests. Please try again after some time.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res) => {
    res.status(429).json({
      statusCode: 429,
      message: "Too many OTP requests. Please try again after some time.",
    });
  },
});

// 10 requests per day
export const otpDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  message: "Daily OTP limit reached. Please try again tomorrow.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res) => {
    res.status(429).json({
      statusCode: 429,
      message: "Daily OTP limit reached. Please try again tomorrow.",
    });
  },
});

// Verification limiter (Max 5 attempts handling is done in Service/DB, but API spam protection here)
// 10 verifications per minute per IP (DDoS protection)
export const otpVerificationRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: "Too many verification attempts.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator, // Use identifier for verification too
});

// Combined limiter for backward compatibility if needed, or just export distinct ones
export const otpGenerationRateLimiter = [otpShortTermLimiter, otpDailyLimiter];
