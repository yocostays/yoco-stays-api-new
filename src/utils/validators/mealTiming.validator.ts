import { z } from "zod";


export const SetMealTimingSchema = z.object({
    hostelId: z.string(),
    breakfastStartTime: z.string().nullable().optional(),
    breakfastEndTime: z.string().nullable().optional(),
    lunchStartTime: z.string().nullable().optional(),
    lunchEndTime: z.string().nullable().optional(),
    snacksStartTime: z.string().nullable().optional(),
    snacksEndTime: z.string().nullable().optional(),
    dinnerStartTime: z.string().nullable().optional(),
    dinnerEndTime: z.string().nullable().optional(),
});

export const GetMealTimingSchema = z.object({
    hostelId: z.string(),
});
