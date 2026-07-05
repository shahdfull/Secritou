import { z } from "zod";

export const createTimeEntrySchema = z.object({
  taskId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  minutes: z.number().int().min(1).max(1440),
  date: z.coerce.date(),
});

export const timeSummaryQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});
