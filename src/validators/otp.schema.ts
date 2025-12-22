import { z } from "zod";

export enum OtpPurpose {
  LOGIN = "LOGIN",
  RESET_PASSWORD = "RESET_PASSWORD",
  CHANGE_EMAIL = "CHANGE_EMAIL",
  CHANGE_PHONE = "CHANGE_PHONE",
  ACCOUNT_DELETE = "ACCOUNT_DELETE",
  VERIFICATION = "VERIFICATION", // Generic verification
}

export enum OtpChannel {
  EMAIL = "EMAIL",
  SMS = "SMS",
}

// Helper to transform legacy email/phone to identifier/channel
const legacyRequestTransform = (data: any) => {
  if (data.email) {
    return { ...data, identifier: data.email, channel: OtpChannel.EMAIL };
  }
  if (data.phone) {
    return { ...data, identifier: data.phone, channel: OtpChannel.SMS };
  }
  return data;
};

export const requestOtpSchema = z.preprocess(
  legacyRequestTransform,
  z.object({
    identifier: z.string().min(1, "Identifier/Email/Phone is required"),
    channel: z.nativeEnum(OtpChannel),
    purpose: z.nativeEnum(OtpPurpose),
  })
);

export const verifyOtpSchema = z.preprocess(
  legacyRequestTransform,
  z.object({
    identifier: z.string().min(1, "Identifier is required"),
    purpose: z.nativeEnum(OtpPurpose),
    otp: z.string().length(6, "OTP must be 6 digits"),
  })
);

export const resetPasswordSchema = z.preprocess(
  legacyRequestTransform,
  z.object({
    identifier: z.string().min(1, "Identifier is required"),
    purpose: z.nativeEnum(OtpPurpose),
    otp: z.string(),
    password: z.string().min(6, "Password must be at least 4 characters"),
  })
);
