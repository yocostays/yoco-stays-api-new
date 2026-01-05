import { z } from "zod";

export const SetMealTimingSchema = z.object({
  hostelId: z.string().min(1, "Hostel ID is required"),
  breakfastStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
  breakfastEndTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
  lunchStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
  lunchEndTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
  snacksStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
  snacksEndTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
  dinnerStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
  dinnerEndTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
}).superRefine((data, ctx) => {
  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const meals = [
    { name: "Breakfast", start: data.breakfastStartTime, end: data.breakfastEndTime },
    { name: "Lunch", start: data.lunchStartTime, end: data.lunchEndTime },
    { name: "Snacks", start: data.snacksStartTime, end: data.snacksEndTime },
    { name: "Dinner", start: data.dinnerStartTime, end: data.dinnerEndTime },
  ].map(meal => ({
    ...meal,
    _start: timeToMinutes(meal.start),
    _end: timeToMinutes(meal.end),
  }));

  // Validate Intra-Meal Timing (Start < End)
  meals.forEach(meal => {
    if (meal._start >= meal._end) {
      ctx.addIssue({
        code: "custom",
        message: `${meal.name} end time must be after its start time.`,
        path: [`${meal.name.toLowerCase()}EndTime`],
      });
    }
  });

  // Validate Inter-Meal Overlap (End of Prev <= Start of Next)
  // Constraint: Breakfast <= Lunch <= Snacks <= Dinner
  for (let i = 0; i < meals.length - 1; i++) {
    const current = meals[i];
    const next = meals[i + 1];

    // Only check if individual meal times are valid (start < end)
    // This prevents double-reporting if an individual meal is invalid AND overlaps
    if (current._start < current._end && next._start < next._end) {
      // Overlap Check
      if (next._start < current._end) {
        ctx.addIssue({
          code: "custom",
          message: `Meal times cannot overlap. ${current.name} ends at ${current.end}, but ${next.name} starts at ${next.start}.`,
          path: [`${next.name.toLowerCase()}StartTime`],
        });
      }
    }
  }
});

export const GetMealTimingSchema = z.object({
  hostelId: z.string(),
});
