import { z } from "zod";
import { currencyCode } from "./common.schema.js";

export const proposalSectionSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().max(10000).optional(),
  orderIndex: z.number().int().nonnegative().default(0),
});

export const proposalBaseSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  amount: z.number().nonnegative().optional(),
  currency: currencyCode.default("TND"),
  clientId: z.string().uuid(),
  clientName: z.string().max(255).optional(),
  email: z.string().email().max(255).optional(),
  leadId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  serviceRequestId: z.string().uuid().optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  sections: z.array(proposalSectionSchema).optional(),
});

export const createProposalSchema = proposalBaseSchema;
export const updateProposalSchema = proposalBaseSchema.partial();

export const rejectProposalSchema = z.object({
  comment: z.string().max(2000).optional(),
});

export const respondToProposalSchema = z.object({
  action: z.enum(["accept", "reject"]),
  comment: z.string().max(2000).optional(),
  expectedVersion: z.number().int().positive().optional(),
});
