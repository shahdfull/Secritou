import { z } from "zod";

export const createLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  source: z.enum(["Site web", "LinkedIn", "Recommandation", "Email", "Appel entrant", "Autre"]).optional(),
  notes: z.string().optional(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"]).default("NEW"),
});

export const updateLeadSchema = createLeadSchema.partial();

export type CreateLeadForm = z.input<typeof createLeadSchema>;
export type UpdateLeadForm = z.input<typeof updateLeadSchema>;
