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
}).superRefine((data, ctx) => {
    const getAbsoluteMinutes = (item: { dayOffset: number, time: string }) => {
        const [h, m] = item.time.split(":").map(Number);
        // dayOffset * 1440 mins/day + hours*60 + mins
        return (item.dayOffset * 1440) + (h * 60) + m;
    };

    const meals = [
        { name: "Breakfast", val: getAbsoluteMinutes(data.breakfast), orig: data.breakfast },
        { name: "Lunch", val: getAbsoluteMinutes(data.lunch), orig: data.lunch },
        { name: "Snacks", val: getAbsoluteMinutes(data.snacks), orig: data.snacks },
        { name: "Dinner", val: getAbsoluteMinutes(data.dinner), orig: data.dinner },
    ];

    for (let i = 0; i < meals.length - 1; i++) {
        const current = meals[i];
        const next = meals[i + 1];

        if (current.val >= next.val) {
            ctx.addIssue({
                code: "custom", // Use string literal to avoid deprecation warning
                message: `Invalid Cutoff Order: ${current.name} cutoff must be earlier than ${next.name}.`,
                path: [`${next.name.toLowerCase()}`], // Highlight the later meal's object
            });
        }
    }
});

export const GetMealCutoffSchema = z.object({
    hostelId: z.string().min(1, "Hostel ID is required"),
});

export type SetMealCutoffInput = z.infer<typeof SetMealCutoffSchema>;
