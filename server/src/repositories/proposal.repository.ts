import { prisma, prismaRead } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import type { Proposal, ProposalStatus } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";
import { buildOrderBy } from "../utils/listQuery.js";

// SEC-103: options.orderBy comes straight from req.query.orderBy (an arbitrary client-supplied
// string, only type-checked, never validated against real column names) — interpolating it
// directly into Prisma's `orderBy` used to turn an unknown field into a 500 instead of falling
// back to the default sort, unlike leadRepository which already whitelists via buildOrderBy.
const SORTABLE_FIELDS = ["title", "status", "amount", "expiresAt", "createdAt"];

export const proposalRepository = {
  async findAll(
    options: ListQueryOptions & {
      clientId?: string;
      status?: ProposalStatus;
      search?: string;
      serviceId?: string | null;
    }
  ): Promise<PaginatedResult<Proposal & { client: { name: string } }>> {
    const where: Prisma.ProposalWhereInput = {};
    if (options.clientId) where.clientId = options.clientId;
    if (options.status) where.status = options.status;
    const andClauses: Prisma.ProposalWhereInput[] = [];
    if (options.serviceId !== undefined) {
      // SEC-099: mirrors assertProposalInScope — linkedProject.serviceId (the project created
      // FROM this proposal) is authoritative when present; a proposal with no linkedProject yet
      // is scoped by its lead's serviceId (when the lead has one) AND by whether the client
      // already has a project in the manager's pole (neutral if the client has none at all).
      // Previously filtered on `project` (the almost-always-null relation a proposal is
      // optionally created FROM), which hid a MANAGER's own proposals from their own list.
      const serviceId = options.serviceId ?? "__none__";
      andClauses.push({
        OR: [
          { linkedProject: { is: { serviceId } } },
          {
            linkedProject: null,
            OR: [{ leadId: null }, { lead: { is: { serviceId: null } } }, { lead: { is: { serviceId } } }],
            client: { is: { OR: [{ projects: { none: {} } }, { projects: { some: { serviceId } } }] } },
          },
        ],
      });
    }
    if (options.search) {
      andClauses.push({
        OR: [
          { title: { contains: options.search, mode: "insensitive" } },
          { description: { contains: options.search, mode: "insensitive" } },
        ],
      });
    }
    if (andClauses.length > 0) where.AND = andClauses;

    const skip = (options.page - 1) * options.pageSize;
    const [data, total] = await Promise.all([
      prismaRead.proposal.findMany({
        where,
        skip,
        take: options.pageSize,
        orderBy: buildOrderBy(options.orderBy, options.orderDir || "desc", SORTABLE_FIELDS, "createdAt"),
        include: {
          client: { select: { name: true } },
          invoice: { select: { id: true } },
        },
      }),
      prismaRead.proposal.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findAllByClientId(
    clientId: string,
    options: { page: number; pageSize: number; status?: ProposalStatus }
  ): Promise<PaginatedResult<Proposal & { client: { name: string } }>> {
    const where: Prisma.ProposalWhereInput = { clientId };
    if (options.status) where.status = options.status;
    const skip = (options.page - 1) * options.pageSize;
    const [data, total] = await Promise.all([
      prismaRead.proposal.findMany({
        where,
        skip,
        take: options.pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { name: true } },
          invoice: { select: { id: true } },
          sections: { orderBy: { orderIndex: "asc" } },
        },
      }),
      prismaRead.proposal.count({ where }),
    ]);
    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findByIdForClient(id: string, clientId: string) {
    return prismaRead.proposal.findFirst({
      where: { id, clientId },
      include: {
        sections: { orderBy: { orderIndex: "asc" } },
        invoice: { select: { id: true } },
      },
    });
  },

  async findById(id: string) {
    return prismaRead.proposal.findUnique({
      where: { id },
      include: {
        client: true,
        sections: { orderBy: { orderIndex: "asc" } },
        history: { include: { user: true }, orderBy: { createdAt: "desc" } },
        invoice: { select: { id: true } },
        linkedProject: { select: { id: true, serviceId: true } },
      },
    });
  },

  async create(data: {
    title: string;
    description?: string;
    status?: ProposalStatus;
    amount?: number;
    currency?: string;
    expiresAt?: Date;
    pdfUrl?: string;
    clientId: string;
    clientName?: string;
    email?: string;
    projectId?: string;
    serviceRequestId?: string;
    leadId?: string;
  }) {
    return prisma.proposal.create({ data });
  },

  async update(id: string, data: Prisma.ProposalUncheckedUpdateInput) {
    return prisma.proposal.update({ where: { id }, data });
  },

  async findProposalBySectionId(sectionId: string) {
    const section = await prismaRead.proposalSection.findFirst({
      where: { id: sectionId },
      select: {
        proposal: {
          select: {
            id: true,
            status: true,
            version: true,
            projectId: true,
            title: true,
            clientId: true,
            leadId: true,
            linkedProject: { select: { serviceId: true } },
          },
        },
      },
    });
    return section?.proposal ?? null;
  },

  async delete(id: string) {
    return prisma.proposal.delete({ where: { id } });
  },

  async addSection(proposalId: string, data: { title: string; content?: string; orderIndex: number }) {
    await prismaRead.proposal.findUniqueOrThrow({ where: { id: proposalId }, select: { id: true } });
    return prisma.proposalSection.create({ data: { ...data, proposalId } });
  },

  async updateSection(id: string, data: { title?: string; content?: string; orderIndex?: number }) {
    return prisma.proposalSection.update({ where: { id }, data });
  },

  async deleteSection(id: string) {
    return prisma.proposalSection.delete({ where: { id } });
  },

  async addHistory(proposalId: string, data: { action: string; comment?: string; userId?: string }) {
    return prisma.proposalHistory.create({ data: { ...data, proposalId } });
  },
};
