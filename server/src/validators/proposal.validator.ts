import { z } from "zod";

const uuidParam = z.string().uuid();
const currencyCode = z.string().length(3).toUpperCase();

export const createProposalSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255),
    description: z.string().max(5000).optional(),
    amount: z.number().nonnegative().optional(),
    currency: currencyCode.default("TND"),
    clientId: z.string().uuid(),
    // Optional contact snapshot (pre-filled from the source Lead when created from a lead).
    clientName: z.string().max(255).optional(),
    email: z.string().email().max(255).optional(),
    projectId: z.string().uuid().optional(),
    serviceRequestId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    expiresAt: z.string().datetime({ offset: true }).optional(),
    sections: z.array(z.object({
      title: z.string().min(1).max(255),
      content: z.string().max(10000).optional(),
      orderIndex: z.number().int().nonnegative().default(0),
    })).optional(),
  }),
});

export const updateProposalSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).optional(),
    amount: z.number().nonnegative().optional(),
    currency: currencyCode.optional(),
    expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
  }),
});

export const proposalIdParamSchema = z.object({
  params: z.object({ id: uuidParam }),
});

export const rejectProposalSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    comment: z.string().max(2000).optional(),
  }),
});

export const respondToProposalSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    action: z.enum(["accept", "reject"]),
    comment: z.string().max(2000).optional(),
    // Optimistic-concurrency token: the proposal version the client reviewed before accepting.
    expectedVersion: z.number().int().positive().optional(),
  }),
});

export const addSectionSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    title: z.string().min(1).max(255),
    content: z.string().max(10000).optional(),
    orderIndex: z.number().int().nonnegative().default(0),
  }),
});

export const updateSectionSchema = z.object({
  params: z.object({ id: uuidParam, sectionId: uuidParam }),
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    content: z.string().max(10000).optional(),
    orderIndex: z.number().int().nonnegative().optional(),
  }),
});

export const sectionParamSchema = z.object({
  params: z.object({ id: uuidParam, sectionId: uuidParam }),
});
