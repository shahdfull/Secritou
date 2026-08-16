import { prismaRead } from "../config/prisma.js";
import type { Prisma, AuditLog } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

export const auditLogRepository = {
  // SEC-114: AuditLog.actorId has no Prisma relation to User (see schema.prisma) — the caller
  // (auditLog.service.ts) resolves display names separately via userRepository.findNamesByIds,
  // this repository only ever touches the AuditLog table itself.
  async findAll(
    options: ListQueryOptions & { entityType?: string; entityId?: string; actorId?: string; action?: string }
  ): Promise<PaginatedResult<AuditLog>> {
    const where: Prisma.AuditLogWhereInput = {};
    if (options.entityType) where.entityType = options.entityType;
    if (options.entityId) where.entityId = options.entityId;
    if (options.actorId) where.actorId = options.actorId;
    if (options.action) where.action = options.action;

    const skip = (options.page - 1) * options.pageSize;
    const [data, total] = await Promise.all([
      prismaRead.auditLog.findMany({
        where,
        skip,
        take: options.pageSize,
        orderBy: { [options.orderBy || "createdAt"]: options.orderDir || "desc" },
      }),
      prismaRead.auditLog.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  // Distinct entityType values actually present — powers a filter dropdown without hardcoding
  // a list that could drift from what services actually write (grep confirmed 10 distinct values
  // across 9 services at the time this was written: Approval, Client, ContactRequest, CreditNote,
  // Invoice, Lead, PermissionProfile, Project, Task, User).
  async findDistinctEntityTypes(): Promise<string[]> {
    const rows = await prismaRead.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    });
    return rows.map((r) => r.entityType);
  },
};
