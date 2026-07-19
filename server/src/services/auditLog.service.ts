import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import logger from "../utils/logger.js";

export interface AuditLogEntry {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
}

export const auditLogService = {
  // Append-only. Never let a logging failure block the action it's recording — log the
  // failure and move on rather than throwing.
  async record(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? undefined,
          actorRole: entry.actorRole ?? undefined,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          before: entry.before === undefined ? undefined : (entry.before as Prisma.InputJsonValue),
          after: entry.after === undefined ? undefined : (entry.after as Prisma.InputJsonValue),
          ipAddress: entry.ipAddress ?? undefined,
        },
      });
    } catch (err) {
      logger.error({ err, entry }, "Failed to write audit log entry");
    }
  },
};
