import { z } from "zod";

export const CreateRoleSchema = z.object({
  categoryType: z
    .string({ message: "Category is required" })
    .trim()
    .min(1, "Category cannot be empty"),
  status: z.boolean().optional().default(true),
});

export const UpdateRoleSchema = z.object({
  categoryType: z
    .string({ message: "Category is required" })
    .trim()
    .min(1, "Category cannot be empty"),
  status: z.boolean().optional(),
});

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
