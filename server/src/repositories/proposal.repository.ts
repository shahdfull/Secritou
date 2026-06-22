import { prisma, prismaRead } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import type { Proposal, ProposalStatus } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

export const proposalRepository = {
  async findAll(
    options: ListQueryOptions & {
      companyId: string;
      clientId?: string;
      leadId?: string;
      status?: ProposalStatus;
      search?: string;
      // When set, restrict to proposals whose project is in this service (MANAGER scope).
      // Proposals with no project are excluded for a scoped manager.
      serviceId?: string | null;
    }
  ): Promise<PaginatedResult<Proposal & { client: { name: string }; lead: { id: string; name: string } | null }>> {
    const where: Prisma.ProposalWhereInput = { companyId: options.companyId };
    if (options.clientId) where.clientId = options.clientId;
    if (options.leadId) where.leadId = options.leadId;
    if (options.status) where.status = options.status;
    if (options.serviceId !== undefined) {
      where.project = { is: { serviceId: options.serviceId ?? "__none__" } };
    }
    if (options.search) {
      where.OR = [
        { title: { contains: options.search, mode: "insensitive" } },
        { description: { contains: options.search, mode: "insensitive" } },
      ];
    }

    const skip = (options.page - 1) * options.pageSize;

    const [data, total] = await Promise.all([
      prismaRead.proposal.findMany({
        where,
        skip,
        take: options.pageSize,
        orderBy: { [options.orderBy || "createdAt"]: options.orderDir || "desc" },
        include: {
          client: { select: { name: true } },
          lead: { select: { id: true, name: true } },
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

  async findById(id: string, companyId: string) {
    return prismaRead.proposal.findUnique({
      where: { id, companyId },
      include: {
        client: true,
        sections: { orderBy: { orderIndex: "asc" } },
        history: { include: { user: true }, orderBy: { createdAt: "desc" } },
        invoice: { select: { id: true } },
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
    leadId?: string;
    companyId: string;
    projectId?: string;
    serviceRequestId?: string;
  }) {
    return prisma.proposal.create({ data });
  },

  async update(
    id: string,
    companyId: string,
    data: Partial<{
      title: string;
      description: string;
      status: ProposalStatus;
      version: number;
      amount: number;
      currency: string;
      expiresAt: Date;
      pdfUrl: string;
      viewedAt: Date;
      acceptedAt: Date;
      rejectedAt: Date;
    }>
  ) {
    return prisma.proposal.update({ where: { id, companyId }, data });
  },

  // Returns the parent proposal's status/version for a given section, scoped to the company.
  // Used to enforce edit guards when a section (which is client-facing content) is changed.
  async findProposalBySectionId(sectionId: string, companyId: string) {
    const section = await prismaRead.proposalSection.findFirst({
      where: { id: sectionId, proposal: { companyId } },
      select: {
        proposal: {
          select: { id: true, status: true, version: true, projectId: true, companyId: true },
        },
      },
    });
    return section?.proposal ?? null;
  },

  async delete(id: string, companyId: string) {
    return prisma.proposal.delete({ where: { id, companyId } });
  },

  async addSection(
    proposalId: string,
    companyId: string,
    data: { title: string; content?: string; orderIndex: number }
  ) {
    // Validate proposal exists in company first
    await prismaRead.proposal.findUniqueOrThrow({
      where: { id: proposalId, companyId },
      select: { id: true }
    });
    return prisma.proposalSection.create({ data: { ...data, proposalId } });
  },

  async updateSection(
    id: string,
    companyId: string,
    data: { title?: string; content?: string; orderIndex?: number }
  ) {
    // Validate section belongs to a proposal in the company
    return prisma.proposalSection.update({
      where: {
        id,
        proposal: { companyId }
      },
      data
    });
  },

  async deleteSection(id: string, companyId: string) {
    // Validate section belongs to a proposal in the company
    return prisma.proposalSection.delete({
      where: {
        id,
        proposal: { companyId }
      }
    });
  },

  async addHistory(
    proposalId: string,
    data: { action: string; comment?: string; userId?: string }
  ) {
    return prisma.proposalHistory.create({ data: { ...data, proposalId } });
  },
};
