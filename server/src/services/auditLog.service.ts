import type { Prisma, AuditLog } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import logger from "../utils/logger.js";
import { auditLogRepository } from "../repositories/auditLog.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

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

// SEC-114: read-side of the audit trail — auditLogService.record() (below) has written to this
// table since well before this type existed; this is the first consumer that reads it back.
export type AuditLogListItem = AuditLog & { actorName: string | null; actorEmail: string | null };

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

  // ADMIN-only read (enforced at the route level, see auditLog.routes.ts) — ipAddress is
  // included as-is (not redacted): the same ADMIN role already sees it unfiltered on every other
  // sensitive screen in this app (e.g. Document.accessLog), so no new exposure is introduced here.
  async findAll(
    options: ListQueryOptions & { entityType?: string; entityId?: string; actorId?: string; action?: string }
  ): Promise<PaginatedResult<AuditLogListItem>> {
    const result = await auditLogRepository.findAll(options);
    const actorIds = [...new Set(result.data.map((entry) => entry.actorId).filter((id): id is string => !!id))];
    const actors = await userRepository.findNamesByIds(actorIds);
    return {
      ...result,
      data: result.data.map((entry) => ({
        ...entry,
        actorName: entry.actorId ? (actors.get(entry.actorId)?.name ?? null) : null,
        actorEmail: entry.actorId ? (actors.get(entry.actorId)?.email ?? null) : null,
      })),
    };
  },

  async findDistinctEntityTypes(): Promise<string[]> {
    return auditLogRepository.findDistinctEntityTypes();
  },
};
