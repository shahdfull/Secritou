import { z } from "zod";

const uuidParam = z.string().uuid();

export const createApprovalSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255),
    description: z.string().max(5000).optional(),
    clientId: z.string().uuid(),
    projectId: z.string().uuid().optional(),
    dueDate: z.string().datetime({ offset: true }).optional(),
  }),
});

export const updateApprovalSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).optional(),
    dueDate: z.string().datetime({ offset: true }).optional(),
  }),
});

export const approvalActionSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    comment: z.string().max(2000).optional(),
  }),
});

export const respondToApprovalSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    action: z.enum(["approve", "reject", "comment"]),
    comment: z.string().max(2000).optional(),
  }),
});

export const addAttachmentSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    name: z.string().min(1).max(255),
    url: z.string().url().max(500),
  }),
});

export const approvalIdParamSchema = z.object({
  params: z.object({ id: uuidParam }),
});

export const attachmentParamSchema = z.object({
  params: z.object({
    id: uuidParam,
    attachmentId: uuidParam,
  }),
});
