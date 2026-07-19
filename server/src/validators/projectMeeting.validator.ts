import { z } from "zod";

export const createProjectMeetingSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    meetingDate: z.string().datetime({ offset: true }),
    participants: z.string().max(2000).optional(),
    notes: z.string().max(5000).optional(),
  }),
});

export const updateProjectMeetingSchema = z.object({
  params: z.object({ id: z.string().uuid(), meetingId: z.string().uuid() }),
  body: z.object({
    meetingDate: z.string().datetime({ offset: true }).optional(),
    participants: z.string().max(2000).optional(),
    notes: z.string().max(5000).optional(),
  }),
});

export const deleteProjectMeetingSchema = z.object({
  params: z.object({ id: z.string().uuid(), meetingId: z.string().uuid() }),
});

export const updateMeetingScheduleSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    frequency: z.enum(["NONE", "WEEKLY", "BIWEEKLY", "MONTHLY"]),
    // Anchor date for the cadence — required unless turning recurrence off.
    // e.g. "next Monday" for WEEKLY, this exact date for the first occurrence.
    nextMeetingDate: z.string().datetime({ offset: true }).optional(),
  }).refine(
    (data) => data.frequency === "NONE" || !!data.nextMeetingDate,
    { message: "nextMeetingDate is required when frequency is not NONE", path: ["nextMeetingDate"] }
  ),
});
