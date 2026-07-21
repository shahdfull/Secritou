// Lead Repository - Data access layer
import { prisma, prismaRead } from "../config/prisma.js";
import type { Lead, LeadStatus, Role, Prisma } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";
import { buildOrderBy, buildTextSearchFilter } from "../utils/listQuery.js";

const SORTABLE_FIELDS = ["name", "email", "status", "source", "createdAt"];

export type LeadScope = { userRole: Role; userServiceId?: string | null; userId?: string };

function buildWhere(options: ListQueryOptions & { includeArchived?: boolean }, scope?: LeadScope) {
  const serviceFilter =
    scope?.userRole === "MANAGER"
      ? {
          OR: [
            { serviceId: scope.userServiceId ?? "__none__" },
            { assignedManagerId: scope.userId },
          ],
        }
      : {};
  return {
    ...(!options.includeArchived ? { archivedAt: null } : {}),
    ...serviceFilter,
    ...(options.status ? { status: options.status as LeadStatus } : {}),
    ...buildTextSearchFilter(options.search, ["name", "email", "source", "notes"]),
  };
}

// SEC-171: the list endpoint (up to 500 rows/call since LEADS_MAX_PAGE_SIZE) has no reason to
// carry `notes` (free-text Text field) on every row — LeadsKanban.tsx and every other list/kanban
// consumer only ever read the fields below (confirmed by grep: `notes` is only read on the single
// lead detail view, which calls findById, not findAll). Kept as an explicit allow-list rather
// than `omit: { notes: true }` so a future field addition to the model doesn't silently leak into
// the list payload without a deliberate decision.
const leadListSelect = {
  id: true, name: true, email: true, phone: true, source: true, status: true,
  serviceId: true, convertedClientId: true, archivedAt: true, sourceContactId: true,
  assignedManagerId: true, department: true, lostReason: true,
  createdAt: true, updatedAt: true,
} satisfies Prisma.LeadSelect;

export const leadRepository = {
  async findAll(options: ListQueryOptions & { includeArchived?: boolean }, scope?: LeadScope): Promise<PaginatedResult<Omit<Lead, "notes">>> {
    const where = buildWhere(options, scope);
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir, SORTABLE_FIELDS, "createdAt");

    const [data, total] = await Promise.all([
      prismaRead.lead.findMany({ where, orderBy, skip, take: options.pageSize, select: leadListSelect }),
      prismaRead.lead.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(id: string, scope?: LeadScope, includeArchived?: boolean): Promise<Lead | null> {
    const serviceFilter =
      scope?.userRole === "MANAGER"
        ? {
            OR: [
              { serviceId: scope.userServiceId ?? "__none__" },
              { assignedManagerId: scope.userId },
            ],
          }
        : {};
    return prismaRead.lead.findFirst({
      where: {
        id,
        ...(!includeArchived ? { archivedAt: null } : {}),
        ...serviceFilter
      }
    });
  },

  async findByIdWithProposals(id: string, scope?: LeadScope, includeArchived?: boolean) {
    const serviceFilter =
      scope?.userRole === "MANAGER"
        ? {
            OR: [
              { serviceId: scope.userServiceId ?? "__none__" },
              { assignedManagerId: scope.userId },
            ],
          }
        : {};
    return prismaRead.lead.findFirst({
      where: {
        id,
        ...(!includeArchived ? { archivedAt: null } : {}),
        ...serviceFilter
      },
      include: {
        convertedClient: { select: { id: true, name: true, email: true } },
        sourceContact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            serviceType: true,
            company: true,
            budget: true,
            message: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
  },

  // SEC-155: used to reject a duplicate manual lead creation before it happens — only
  // active (non-archived) leads count as a conflict, so a prospect who was previously lost/won
  // and archived can be re-entered as a fresh lead.
  async findFirstByEmail(email: string): Promise<Pick<Lead, "id" | "name"> | null> {
    return prismaRead.lead.findFirst({
      where: { email, archivedAt: null },
      select: { id: true, name: true },
    });
  },

  async create(data: {
    name: string;
    email?: string;
    phone?: string;
    source?: string;
    status?: LeadStatus;
    notes?: string;
    serviceId?: string;
    assignedManagerId?: string;
  }): Promise<Lead> {
    return prisma.lead.create({ data });
  },

  async update(id: string, data: Prisma.LeadUncheckedUpdateInput): Promise<Lead> {
    return prisma.lead.update({ where: { id }, data });
  },

  async archive(id: string, convertedClientId?: string): Promise<Lead> {
    return prisma.lead.update({
      where: { id },
      data: { status: "WON", archivedAt: new Date(), convertedClientId },
    });
  },

  async delete(id: string): Promise<Lead> {
    return prisma.lead.delete({ where: { id } });
  },
};
