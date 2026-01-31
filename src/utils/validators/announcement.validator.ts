import { z } from "zod";
import dayjs from "dayjs";
import { EventStatus, AnnouncementStatus } from "../enum";

const booleanString = z.preprocess((val) => {
  if (typeof val === "string") {
    if (val === "true") return true;
    if (val === "false") return false;
  }
  return val;
}, z.boolean().optional());

export const CreateAnnouncementSchema = z
  .object({
    title: z
      .string({ message: "Title is required" })
      .min(1, "Title cannot be empty"),
    publishFrom: z
      .string({ message: "Publish from date is required" })
      .refine((val) => dayjs(val, "YYYY-MM-DD", true).isValid(), {
        message: "Invalid publishFrom date format (YYYY-MM-DD)",
      }),
    publishTo: z
      .string({ message: "Publish to date is required" })
      .refine((val) => dayjs(val, "YYYY-MM-DD", true).isValid(), {
        message: "Invalid publishTo date format (YYYY-MM-DD)",
      }),
    hostelId: z
      .string({ message: "Hostel ID is required" })
      .min(24, "Invalid Hostel ID")
      .max(24, "Invalid Hostel ID"),
    eventName: z.string().optional(),
    eventTagline: z.string().optional(),
    startDate: z
      .string()
      .refine((val) => dayjs(val, "YYYY-MM-DD", true).isValid(), {
        message: "Invalid startDate format (YYYY-MM-DD)",
      })
      .optional(),
    endDate: z
      .string()
      .refine((val) => dayjs(val, "YYYY-MM-DD", true).isValid(), {
        message: "Invalid endDate format (YYYY-MM-DD)",
      })
      .optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    venue: z.string().optional(),
    attachmentLinks: z.string().optional(),
    activeStudentsOnly: booleanString.default(false),
    isHidden: booleanString.default(false),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        const start = dayjs(data.startDate);
        const end = dayjs(data.endDate);
        return !end.isBefore(start);
      }
      return true;
    },
    {
      message: "endDate must be on or after startDate",
      path: ["endDate"],
    },
  )
  .refine(
    (data) => {
      const from = dayjs(data.publishFrom);
      const to = dayjs(data.publishTo);
      return !to.isBefore(from);
    },
    {
      message: "publishTo date must be on or after publishFrom date",
      path: ["publishTo"],
    },
  );

export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementSchema>;

export const UpdateAnnouncementSchema = z
  .object({
    title: z.string().min(1, "Title cannot be empty").optional(),
    eventName: z.string().min(1, "Event name cannot be empty").optional(),
    eventTagline: z.string().min(1, "Event tagline cannot be empty").optional(),
    publishFrom: z
      .string()
      .refine((val) => dayjs(val, "YYYY-MM-DD", true).isValid(), {
        message: "Invalid publishFrom date format (YYYY-MM-DD)",
      })
      .optional(),
    publishTo: z
      .string()
      .refine((val) => dayjs(val, "YYYY-MM-DD", true).isValid(), {
        message: "Invalid publishTo date format (YYYY-MM-DD)",
      })
      .optional(),
    startDate: z
      .string()
      .refine((val) => dayjs(val, "YYYY-MM-DD", true).isValid(), {
        message: "Invalid startDate format (YYYY-MM-DD)",
      })
      .optional(),
    endDate: z
      .string()
      .refine((val) => dayjs(val, "YYYY-MM-DD", true).isValid(), {
        message: "Invalid endDate format (YYYY-MM-DD)",
      })
      .optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    venue: z.string().optional(),
    isHidden: booleanString,
    eventStatus: z.enum([EventStatus.ACTIVE, EventStatus.CANCELLED]).optional(),
    activeStudentsOnly: booleanString,
    attachmentLinks: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        const start = dayjs(data.startDate);
        const end = dayjs(data.endDate);
        return !end.isBefore(start);
      }
      return true;
    },
    {
      message: "endDate must be on or after startDate",
      path: ["endDate"],
    },
  )
  .refine(
    (data) => {
      if (data.publishFrom && data.publishTo) {
        const from = dayjs(data.publishFrom);
        const to = dayjs(data.publishTo);
        return !to.isBefore(from);
      }
      return true;
    },
    {
      message: "publishTo date must be on or after publishFrom date",
      path: ["publishTo"],
    },
  );

export type UpdateAnnouncementInput = z.infer<typeof UpdateAnnouncementSchema>;

export const GetWardenAnnouncementsSchema = z.object({
  hostelId: z.string().min(24).max(24),
  status: z.nativeEnum(AnnouncementStatus).optional(),
  isHidden: booleanString,
  fromDate: z
    .string()
    .refine((val) => dayjs(val, "YYYY-MM-DD", true).isValid(), {
      message: "Invalid fromDate format (YYYY-MM-DD)",
    })
    .optional(),
  toDate: z
    .string()
    .refine((val) => dayjs(val, "YYYY-MM-DD", true).isValid(), {
      message: "Invalid toDate format (YYYY-MM-DD)",
    })
    .optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

export type GetWardenAnnouncementsInput = z.infer<
  typeof GetWardenAnnouncementsSchema
>;
