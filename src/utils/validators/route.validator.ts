import { z } from "zod";

export const CreateRouteSchema = z.object({
  title: z
    .string({ message: "Title is required" })
    .trim()
    .min(1, "Title cannot be empty"),
  link: z
    .string({ message: "Link is required" })
    .trim()
    .min(1, "Link cannot be empty"),
  icon: z
    .string({ message: "Icon is required" })
    .trim()
    .min(1, "Icon cannot be empty"),
  platform: z.enum(["web", "mobile"], {
    message: "Platform must be 'web' or 'mobile'",
  }),
  status: z.boolean().optional().default(true),
});

export const UpdateRouteSchema = z.object({
  title: z.string().trim().min(1).optional(),
  link: z.string().trim().min(1).optional(),
  icon: z.string().trim().min(1).optional(),
  platform: z.enum(["web", "mobile"]).optional(),
  status: z.boolean().optional(),
});
