import { z } from "zod";
import { UnitTypes } from "../enum";
import dayjs from "dayjs";

const MealWastageSchema = z.object({
    amount: z.number({ message: "Amount is required" }),
    unit: z.enum(Object.values(UnitTypes) as [string, ...string[]]).default(UnitTypes.G) as unknown as z.ZodType<UnitTypes>,
});

export const CreateFoodWastageSchema = z.object({
    hostelId: z.string({ message: "Hostel ID is required" }).min(24, "Invalid Hostel ID").max(24, "Invalid Hostel ID"),
    date: z.string({ message: "Date is required" }).refine((val) => dayjs(val).isValid(), {
        message: "Invalid date format",
    }).refine((val) => {
        const inputDate = dayjs(val).startOf("day");
        const today = dayjs().startOf("day");
        return !inputDate.isAfter(today);
    }, {
        message: "Future dates are not allowed",
    }),
    breakfast: MealWastageSchema.optional(),
    lunch: MealWastageSchema.optional(),
    snacks: MealWastageSchema.optional(),
    dinner: MealWastageSchema.optional(),
}).refine((data) => data.breakfast || data.lunch || data.snacks || data.dinner, {
    message: "At least one meal wastage entry is required",
    path: ["breakfast"],
});

export type CreateFoodWastageInput = z.infer<typeof CreateFoodWastageSchema>;

export const FoodWastagePaginationSchema = z.object({
    hostelId: z.string({ message: "Hostel ID is required" }).min(24, "Invalid Hostel ID").max(24, "Invalid Hostel ID"),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(10),
    sort: z.enum(["RECENT", "OLDEST"]).optional().default("RECENT"),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date format (YYYY-MM-DD)").optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date format (YYYY-MM-DD)").optional(),
});

export type FoodWastagePaginationInput = z.infer<typeof FoodWastagePaginationSchema>;
