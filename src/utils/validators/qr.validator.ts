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
    purpose: z.enum([QRPurpose.MESS_ATTENDANCE, QRPurpose.LEAVE, QRPurpose.HOSTEL_ATTENDANCE], {
        message: "Invalid QR purpose. Must be MESS_ATTENDANCE, LEAVE, or HOSTEL_ATTENDANCE",
    }),
});

export type GenerateQRRequest = z.infer<typeof GenerateQRSchema>;
