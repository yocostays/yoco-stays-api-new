import { z } from "zod";

const MealBookingSchema = z
  .object({
    date: z
      .string({ message: "Date is required (YYYY-MM-DD)" })
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
    // Explicit state-based fields
    meals: z.object(
      {
        breakfast: z.enum(["PENDING", "CONFIRMED", "SKIPPED"] as const, {
          message:
            "Breakfast status must be 'PENDING', 'CONFIRMED', or 'SKIPPED'",
        }),
        lunch: z.enum(["PENDING", "CONFIRMED", "SKIPPED"] as const, {
          message: "Lunch status must be 'PENDING', 'CONFIRMED', or 'SKIPPED'",
        }),
        snacks: z.enum(["PENDING", "CONFIRMED", "SKIPPED"] as const, {
          message: "Snacks status must be 'PENDING', 'CONFIRMED', or 'SKIPPED'",
        }),
        dinner: z.enum(["PENDING", "CONFIRMED", "SKIPPED"] as const, {
          message: "Dinner status must be 'PENDING', 'CONFIRMED', or 'SKIPPED'",
        }),
      },
      {
        message:
          "Missing or invalid 'meals' object. Request must include 'meals' object with statuses.",
      }
    ),
  })
  .strict();

export const BulkMealBookingSchema = z.object({
  bookings: z
    .array(MealBookingSchema)
    .min(1, "At least 1 booking required")
    .max(10, "Max 10 days per request"),
});

export type MealBookingInput = z.infer<typeof MealBookingSchema>;
export type BulkMealBookingInput = z.infer<typeof BulkMealBookingSchema>;

export const CalendarMonthViewSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format")
      .optional(),
    year: z.number().int().min(2000).max(2100).optional(),
    month: z.number().int().min(1).max(12).optional(),
  })
  .refine(
    (data) => {
      if (data.year && !data.month) return false;
      if (data.month && !data.year) return false;
      if (data.date && (data.year || data.month)) return false;
      return true;
    },
    {
      message: "Provide either 'date' OR both 'year' and 'month', not both",
    }
  );

export const MealStateAnalyticsSchema = z.object({
  hostelId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid Hostel ID")
    .min(1, "Hostel ID is required"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
});

export const MessMenuPaginationSchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).optional(),
  sort: z.enum(["RECENT", "OLDEST"]).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD format")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD format")
    .optional(),
}).passthrough();

export const CreateMessMenuSchema = z.object({
  hostelId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid Hostel ID")
    .optional(), // Can be from token
  fromDate: z
    .string({ message: "Date is required (YYYY-MM-DD)" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  breakfast: z.string().min(1, "Breakfast menu is required"),
  lunch: z.string().min(1, "Lunch menu is required"),
  snacks: z.string().min(1, "Snacks menu is required"),
  dinner: z.string().min(1, "Dinner menu is required"),
}).passthrough();
