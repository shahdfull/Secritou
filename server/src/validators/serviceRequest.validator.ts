import { z } from "zod";

const SERVICE_REQUEST_TYPES = ["SUPPORT", "NEW_PROJECT"] as const;

const ADMIN_STATUSES = [
  "NEW",
  "IN_REVIEW",
  "IN_PROGRESS",
  "WAITING_CLIENT",
  "COMPLETED",
  "CANCELLED",
] as const;

const CLIENT_STATUSES = ["NEW", "IN_PROGRESS"] as const;

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

const serviceRequestBaseSchema = z.object({
  title: z.string().min(2).max(255),
  description: z.string().max(5000).optional(),
});

// ── Client schemas ─────────────────────────────────────────────────────────────

export const createServiceRequestSchema = z.object({
  body: serviceRequestBaseSchema.extend({
    type: z.enum(["SUPPORT", "NEW_PROJECT"]).default("NEW_PROJECT"),
  }),
});

export const updateServiceRequestSchema = z.object({
  body: z.object({
    status: z.enum(CLIENT_STATUSES).optional(),
    ...serviceRequestBaseSchema.partial().shape,
  }),
  params: z.object({ id: z.string() }),
});

// ── Admin schemas ──────────────────────────────────────────────────────────────

export const adminUpdateServiceRequestSchema = z.object({
  body: z.object({
    title: z.string().min(2).max(255).optional(),
    description: z.string().max(5000).optional().nullable(),
    status: z.enum(ADMIN_STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    assignedToId: z.string().uuid().optional().nullable(),
  }),
  params: z.object({ id: z.string() }),
});

export const addCommentSchema = z.object({
  body: z.object({
    body: z.string().min(1).max(5000),
    isInternal: z.boolean().default(false),
  }),
  params: z.object({ id: z.string() }),
});

export const deleteCommentSchema = z.object({
  params: z.object({
    id: z.string(),
    commentId: z.string(),
  }),
});

export const adminListServiceRequestsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    orderBy: z.enum(["title", "status", "priority", "createdAt", "updatedAt"]).optional(),
    orderDir: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().max(200).optional(),
    status: z.enum(ADMIN_STATUSES).optional(),
    clientId: z.string().optional(),
    assignedToId: z.string().optional(),
    priority: z.enum(PRIORITIES).optional(),
    type: z.enum(SERVICE_REQUEST_TYPES).optional(),
  }),
});
