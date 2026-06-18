import { prisma } from "../config/prisma.js";
import type { Proposal, ProposalStatus } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

export const proposalRepository = {
  async findAll(
    options: ListQueryOptions & {
      companyId: string;
      clientId?: string;
      status?: ProposalStatus;
      search?: string;
    }
  ): Promise<PaginatedResult<Proposal & { client: { name: string } }>> {
    const where: any = { companyId: options.companyId };
    if (options.clientId) where.clientId = options.clientId;
    if (options.status) where.status = options.status;
    if (options.search) {
      where.OR = [
        { title: { contains: options.search, mode: "insensitive" } },
        { description: { contains: options.search, mode: "insensitive" } },
      ];
    }

    const skip = (options.page - 1) * options.pageSize;

    const [data, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        skip,
        take: options.pageSize,
        orderBy: { [options.orderBy || "createdAt"]: options.orderDir || "desc" },
        include: { client: { select: { name: true } } },
      }),
      prisma.proposal.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(id: string, companyId: string) {
    return prisma.proposal.findUnique({
      where: { id, companyId },
      include: {
        client: true,
        sections: { orderBy: { orderIndex: "asc" } },
        history: { include: { user: true }, orderBy: { createdAt: "desc" } },
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
    companyId: string;
    projectId?: string;
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

  async delete(id: string, companyId: string) {
    return prisma.proposal.delete({ where: { id, companyId } });
  },

  async addSection(
    proposalId: string,
    companyId: string,
    data: { title: string; content?: string; orderIndex: number }
  ) {
    // Validate proposal exists in company first
    await prisma.proposal.findUniqueOrThrow({
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
