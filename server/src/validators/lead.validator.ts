// Lead Validators - Validation schemas
import { z } from "zod";
import { LeadStatus } from "@prisma/client";
import { leadBaseSchema as sharedLeadBase } from "@secritou/shared";

const leadBaseSchema = sharedLeadBase.extend({
  status: z.nativeEnum(LeadStatus).optional(),
});

export const createLeadSchema = z.object({
  body: leadBaseSchema,
});

export const updateLeadSchema = z.object({
  body: leadBaseSchema.partial(),
  params: z.object({
    id: z.string().uuid(),
  }),
});

// Param-only schemas for the id-based actions (no request body).
const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }).strict(),
});

export const deleteLeadSchema = idParamSchema;
export const convertLeadSchema = idParamSchema;
export const reopenLeadSchema = idParamSchema;
