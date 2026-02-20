import { z } from "zod";

export const CreateRoleCategorySchema = z.object({
  categoryType: z
    .string({ message: "categoryType is required" })
    .trim()
    .min(1, "categoryType cannot be empty"),
  status: z.boolean().optional().default(true),
});

export const UpdateRoleCategorySchema = z.object({
  categoryType: z
    .string({ message: "categoryType is required" })
    .trim()
    .min(1, "categoryType cannot be empty")
    .optional(),
  status: z.boolean().optional(),
});

export type CreateRoleCategoryInput = z.infer<typeof CreateRoleCategorySchema>;
export type UpdateRoleCategoryInput = z.infer<typeof UpdateRoleCategorySchema>;
