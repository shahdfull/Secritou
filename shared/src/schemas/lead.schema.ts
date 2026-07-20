import { z } from "zod";

// Base lead schema (shared between client and server). Bounds mirror schema.prisma#Lead's actual
// column widths (name/phone/source @db.VarChar) so a validation error surfaces before an insert
// would otherwise fail on a DB-level truncation; notes is @db.Text (unbounded in Postgres) but
// still capped here for the same reason every other free-text field in the repo is (SEC-104).
export const leadBaseSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  source: z.string().max(100).optional(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"]).default("NEW"),
  notes: z.string().max(5000).optional(),
  lostReason: z.string().max(500).optional(),
});

// Client-side schemas
export const createLeadSchema = leadBaseSchema;
export const updateLeadSchema = createLeadSchema.partial();

export type CreateLeadForm = z.input<typeof createLeadSchema>;
export type UpdateLeadForm = z.input<typeof updateLeadSchema>;
