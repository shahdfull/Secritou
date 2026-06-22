// Lead Repository - Data access layer
import { prismaRead as prisma } from "../config/prisma.js";
import type { Lead, LeadStatus, Role } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";
import { buildOrderBy, buildTextSearchFilter } from "../utils/listQuery.js";

const SORTABLE_FIELDS = ["name", "email", "status", "source", "createdAt"];

export type LeadScope = { userRole: Role; userServiceId?: string | null; userId?: string };
// (kept as a local alias; structurally identical to utils/serviceScope.ServiceScope)

function buildWhere(companyId: string, options: ListQueryOptions, scope?: LeadScope) {
  // A MANAGER only sees leads of their own service (pole) OR leads assigned to them.
  const serviceFilter =
    scope?.userRole === "MANAGER"
      ? { 
          OR: [
            { serviceId: scope.userServiceId ?? "__none__" },
            { assignedManagerId: scope.userId }
          ]
        }
      : {};
  return {
    companyId,
    archivedAt: null,
    ...serviceFilter,
    ...(options.status ? { status: options.status as LeadStatus } : {}),
    ...buildTextSearchFilter(options.search, ["name", "email", "source", "notes"]),
  };
}

export const leadRepository = {
  async findAll(
    companyId: string,
    options: ListQueryOptions,
    scope?: LeadScope
  ): Promise<PaginatedResult<Lead>> {
    const where = buildWhere(companyId, options, scope);
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir, SORTABLE_FIELDS, "createdAt");

    const [data, total] = await Promise.all([
      prisma.lead.findMany({ where, orderBy, skip, take: options.pageSize }),
      prisma.lead.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(id: string, companyId: string, scope?: LeadScope): Promise<Lead | null> {
    const serviceFilter =
      scope?.userRole === "MANAGER"
        ? { 
            OR: [
              { serviceId: scope.userServiceId ?? "__none__" },
              { assignedManagerId: scope.userId }
            ]
          }
        : {};
    return prisma.lead.findFirst({ where: { id, companyId, archivedAt: null, ...serviceFilter } });
  },

  // Same scoping as findById, but eager-loads the linked proposals (most recent first) so the
  // lead detail view can show its "Propositions liées" section.
  async findByIdWithProposals(id: string, companyId: string, scope?: LeadScope) {
    const serviceFilter =
      scope?.userRole === "MANAGER"
        ? {
            OR: [
              { serviceId: scope.userServiceId ?? "__none__" },
              { assignedManagerId: scope.userId },
            ],
          }
        : {};
    return prisma.lead.findFirst({
      where: { id, companyId, archivedAt: null, ...serviceFilter },
      include: {
        proposals: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            status: true,
            amount: true,
            currency: true,
            createdAt: true,
          },
        },
      },
    });
  },

  async create(data: {
    name: string;
    email?: string;
    phone?: string;
    source?: string;
    status?: LeadStatus;
    notes?: string;
    companyId: string;
  }): Promise<Lead> {
    return prisma.lead.create({ data });
  },

  async update(id: string, companyId: string, data: Partial<{
    name?: string;
    email?: string;
    phone?: string;
    source?: string;
    status?: LeadStatus;
    notes?: string;
  }>): Promise<Lead> {
    return prisma.lead.update({ where: { id, companyId }, data });
  },

  async archive(id: string, companyId: string, convertedClientId?: string): Promise<Lead> {
    return prisma.lead.update({
      where: { id, companyId },
      data: { status: "WON", archivedAt: new Date(), convertedClientId },
    });
  },

  async delete(id: string, companyId: string): Promise<Lead> {
    return prisma.lead.delete({ where: { id, companyId } });
  },
};
