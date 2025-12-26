import { z } from "zod";


const MealBookingSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
    breakfast: z.boolean().nullable(),
    lunch: z.boolean().nullable(),
    snacks: z.boolean().nullable(),
    dinner: z.boolean().nullable(),
}).strict();


export const BulkMealBookingSchema = z.object({
    bookings: z.array(MealBookingSchema).min(1, "At least 1 booking required").max(10, "Max 10 days per request"),
});

export type MealBookingInput = z.infer<typeof MealBookingSchema>;
export type BulkMealBookingInput = z.infer<typeof BulkMealBookingSchema>;


export const CalendarMonthViewSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format").optional(),
});
