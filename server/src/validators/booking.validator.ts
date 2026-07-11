import { z } from "zod";
import { isValidTunisianPhone } from "@secritou/shared";

const timeStringSchema = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM time format");

export const openSlotsQuerySchema = z.object({
  query: z.object({
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
  }).partial(),
});

export const createAvailabilitySlotSchema = z.object({
  body: z.object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
  }).refine((value) => value.endTime > value.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  }),
});

export const createRecurringAvailabilitySchema = z.object({
  body: z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    dayStart: timeStringSchema,
    dayEnd: timeStringSchema,
    intervalMinutes: z.coerce.number().int().min(15).max(240),
    weekdaysOnly: z.coerce.boolean().optional().default(false),
    daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).optional(),
  }).refine((value) => value.endDate >= value.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  }),
});

export const bookSlotSchema = z.object({
  body: z.object({
    slotId: z.string().min(1),
    name: z.string().trim().min(2, "Name must contain at least 2 characters"),
    email: z.string().trim().email("Enter a valid email address"),
    phone: z.string().trim().optional().refine((value) => !value || isValidTunisianPhone(value), "Enter a valid Tunisian phone number"),
    notes: z.string().trim().max(1000).optional(),
  }),
});

export const bookingIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export type BookSlotInput = z.infer<typeof bookSlotSchema>["body"];
export type CreateAvailabilitySlotInput = z.infer<typeof createAvailabilitySlotSchema>["body"];
export type CreateRecurringAvailabilityInput = z.infer<typeof createRecurringAvailabilitySchema>["body"];
