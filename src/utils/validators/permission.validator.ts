import { z } from "zod";

// Schema for a single permission item
const PermissionItemSchema = z.object({
  routeId: z
    .string({ message: "Route ID is required" })
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid Route ID format"),
  add: z.boolean().default(false),
  view: z.boolean().default(false),
  edit: z.boolean().default(false),
  delete: z.boolean().default(false),
});

// Schema for creating/updating permissions
export const CreatePermissionSchema = z.object({
  roleId: z
    .string({ message: "Role ID is required" })
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid Role ID format"),
  permission: z.array(PermissionItemSchema).optional().default([]),
  web: z.array(PermissionItemSchema).optional().default([]),
  mobile: z.array(PermissionItemSchema).optional().default([]),
});
