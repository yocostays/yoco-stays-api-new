import { z } from "zod";
import mongoose from "mongoose";


export const WardenMealReportingSchema = z.object({
    hostelId: z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/, "Invalid Hostel ID")
        .refine((val) => mongoose.isValidObjectId(val), {
            message: "Invalid MongoDB ObjectId format",
        }),

    date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),

    filters: z
        .object({
            studentStatus: z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional(),


            mealStatus: z
                .array(z.enum(["Confirmed", "Cancelled", "Missed", "Cancelled-Consumed"]))
                .optional(),

            floor: z.number().int().optional(),

            room: z.number().int().optional(),
        })
        .optional(),

    search: z
        .object({
            text: z.string().min(1).optional(),
        })
        .optional(),

    pagination: z
        .object({
            page: z.number().int().min(1).default(1),
            limit: z.number().int().min(1).max(50).default(10),
        })
        .optional()
        .default({ page: 1, limit: 10 }),

    sort: z
        .object({
            field: z
                .enum(["uniqueId", "name", "floorNumber", "roomNumber"])
                .default("uniqueId"),
            order: z.enum(["asc", "desc"]).default("asc"),
        })
        .optional(),
});

export const WardenStudentMonthlyViewSchema = z
    .object({
        studentId: z
            .string()
            .regex(/^[0-9a-fA-F]{24}$/, "Invalid Student ID"),
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
        filters: z
            .object({
                mealStatus: z
                    .array(
                        z.enum([
                            "CONSUMED",
                            "MISSED",
                            "CONFIRMED",
                            "SKIPPED_CONSUMED",
                            "SKIPPED",
                            "NOT_BOOKED",
                            "PENDING"
                        ])
                    )
                    .optional(),
            })
            .optional(),
    });

export type WardenMealReportingInput = z.infer<typeof WardenMealReportingSchema>;
