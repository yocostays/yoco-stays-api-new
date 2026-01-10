import { z } from "zod";
import { QRPurpose } from "../enum";
import mongoose from "mongoose";

export const GenerateQRSchema = z.object({
  hostelId: z
    .string()
    .min(1, "Hostel ID is required")
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: "Invalid Hostel ID format",
    }),
  purpose: z.enum(
    [QRPurpose.MESS_ATTENDANCE, QRPurpose.LEAVE, QRPurpose.HOSTEL_ATTENDANCE],
    {
      message:
        "Invalid QR purpose. Must be MESS_ATTENDANCE, LEAVE, or HOSTEL_ATTENDANCE",
    }
  ),
});

export const ScanQRSchema = z.object({
  token: z.string().min(1, "QR token is required"),
});

export const GetActiveQRsSchema = z.object({
  hostelId: z
    .string()
    .min(1, "Hostel ID is required")
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: "Invalid Hostel ID format",
    }),
});

export type GenerateQRRequest = z.infer<typeof GenerateQRSchema>;
export type ScanQRRequest = z.infer<typeof ScanQRSchema>;

// Maps MealCountReportType (used in hostel slots) to BookMeals field names
export const MealMapping: Record<string, string> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  "hi-tea": "snacks",
};
