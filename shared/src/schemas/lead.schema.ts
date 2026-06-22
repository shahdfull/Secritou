import { z } from "zod";

// Base lead schema (shared between client and server)
export const leadBaseSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"]).default("NEW"),
  notes: z.string().optional(),
});

// Client-side schemas
export const createLeadSchema = leadBaseSchema;
export const updateLeadSchema = createLeadSchema.partial();

export type CreateLeadForm = z.input<typeof createLeadSchema>;
export type UpdateLeadForm = z.input<typeof updateLeadSchema>;
