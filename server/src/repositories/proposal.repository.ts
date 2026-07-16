import { prisma, prismaRead } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import type { Proposal, ProposalStatus } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

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
        linkedProject: { select: { id: true } },
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
          select: { id: true, status: true, version: true, projectId: true, title: true, clientId: true },
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
