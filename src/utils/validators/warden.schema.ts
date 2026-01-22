import { z } from "zod";
import { OtpChannel, OtpPurpose } from "./otp.schema";

// Transform legacy data structure to the new one
const legacyWardenTransform = (data: any) => {
  if (data.identifier) {
    return data;
  }

  if (data.email) {
    return {
      ...data,
      identifier: data.email,
      channel: OtpChannel.EMAIL,
    };
  }

  if (data.phone) {
    return {
      ...data,
      identifier: String(data.phone),
      channel: OtpChannel.SMS,
    };
  }

  return data;
};

// Schema for generating OTP for Warden
export const generateWardenOtpSchema = z.preprocess(
  legacyWardenTransform,
  z.object({
    identifier: z.string().min(1, "Email or phone is required"),
    channel: z.nativeEnum(OtpChannel, {
      message: "Invalid channel. Must be EMAIL or SMS",
    }),
    purpose: z
      .nativeEnum(OtpPurpose)
      .default(OtpPurpose.RESET_PASSWORD)
      .optional(),
  }),
);

// Schema for resetting Warden password
export const resetWardenPasswordSchema = z.preprocess(
  legacyWardenTransform,
  z.object({
    identifier: z.string().min(1, "Email or phone is required"),
    otp: z.string().length(6, "OTP must be 6 digits"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    purpose: z
      .nativeEnum(OtpPurpose)
      .default(OtpPurpose.RESET_PASSWORD)
      .optional(),
  }),
);
