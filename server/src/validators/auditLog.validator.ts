import { z } from "zod";

export const getAuditLogSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
    orderBy: z.enum(["createdAt", "action", "entityType"]).optional(),
    orderDir: z.enum(["asc", "desc"]).optional(),
    entityType: z.string().max(100).optional(),
    entityId: z.string().uuid().optional(),
    actorId: z.string().uuid().optional(),
    action: z.string().max(100).optional(),
  }),
});
