import { z } from "zod";

const CutoffItemSchema = z.object({
    dayOffset: z.number().int().min(-1).max(0),
    time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
});

export const SetMealCutoffSchema = z.object({
    hostelId: z.string().min(1, "Hostel ID is required"),
    breakfast: CutoffItemSchema,
    lunch: CutoffItemSchema,
    snacks: CutoffItemSchema,
    dinner: CutoffItemSchema,
});

export const GetMealCutoffSchema = z.object({
    hostelId: z.string().min(1, "Hostel ID is required"),
});

export type SetMealCutoffInput = z.infer<typeof SetMealCutoffSchema>;
