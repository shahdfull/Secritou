// Lead Validators - Validation schemas
import { z } from "zod";
import { LeadStatus } from "@prisma/client";

const leadBaseSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  notes: z.string().optional(),
});

export const createLeadSchema = z.object({
  body: leadBaseSchema,
});

export const updateLeadSchema = z.object({
  body: leadBaseSchema.partial(),
  params: z.object({
    id: z.string(),
  }),
});
