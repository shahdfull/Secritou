import { z } from "zod";
import {
  proposalBaseSchema as sharedProposalBase,
  proposalSectionSchema,
  rejectProposalSchema as sharedRejectProposalSchema,
  respondToProposalSchema as sharedRespondToProposalSchema,
} from "@secritou/shared";

const uuidParam = z.string().uuid();

// Optional contact snapshot (pre-filled from the source Lead when created from a lead) — not
// part of the shared base schema since it's populated server-side from the lead, never a
// standalone field a client-only form (without a lead context) would need to represent.
const proposalBaseSchema = sharedProposalBase.extend({
  clientName: z.string().max(255).optional(),
  email: z.string().email().max(255).optional(),
});

export const createProposalSchema = z.object({
  body: proposalBaseSchema,
});

export const updateProposalSchema = z.object({
  params: z.object({ id: uuidParam }),
  // Deliberately narrower than proposalBaseSchema.partial(): clientId/projectId/serviceRequestId/
  // leadId/sections are not updatable via this endpoint (proposalService.update passes the body
  // through close to unchecked to Prisma — this Zod schema is the only real gate on what a client
  // can reassign on an existing proposal, so widening it must be a deliberate decision, not a
  // side effect of reusing the shared create schema).
  body: proposalBaseSchema.pick({ title: true, description: true, amount: true, currency: true, expiresAt: true }).partial(),
});

export const proposalIdParamSchema = z.object({
  params: z.object({ id: uuidParam }),
});

export const rejectProposalSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: sharedRejectProposalSchema,
});

export const respondToProposalSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: sharedRespondToProposalSchema,
});

export const addSectionSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: proposalSectionSchema,
});

export const updateSectionSchema = z.object({
  params: z.object({ id: uuidParam, sectionId: uuidParam }),
  body: proposalSectionSchema.partial(),
});

export const sectionParamSchema = z.object({
  params: z.object({ id: uuidParam, sectionId: uuidParam }),
});
