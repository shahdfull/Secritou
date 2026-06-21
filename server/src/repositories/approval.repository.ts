import { prisma } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import type { Approval, ApprovalStatus } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

export const approvalRepository = {
  async findAll(
    options: ListQueryOptions & {
      companyId: string;
      clientId?: string;
      status?: ApprovalStatus;
      search?: string;
    }
  ): Promise<PaginatedResult<Approval & { client: { name: string } }>> {
    const where: Prisma.ApprovalWhereInput = { companyId: options.companyId };
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
      prisma.approval.findMany({
        where,
        skip,
        take: options.pageSize,
        orderBy: { [options.orderBy || "createdAt"]: options.orderDir || "desc" },
        include: { client: { select: { name: true } } },
      }),
      prisma.approval.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findAllByClientId(
    clientId: string,
    options: { page: number; pageSize: number; status?: ApprovalStatus }
  ): Promise<PaginatedResult<Approval & { client: { name: string } }>> {
    const where: Prisma.ApprovalWhereInput = { clientId };
    if (options.status) where.status = options.status;
    const skip = (options.page - 1) * options.pageSize;
    const [data, total] = await Promise.all([
      prisma.approval.findMany({
        where,
        skip,
        take: options.pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { name: true } },
          attachments: true,
          timeline: { orderBy: { createdAt: "desc" } },
        },
      }),
      prisma.approval.count({ where }),
    ]);
    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findByIdForClient(id: string, clientId: string) {
    return prisma.approval.findFirst({
      where: { id, clientId },
      include: { attachments: true, timeline: { orderBy: { createdAt: "desc" } } },
    });
  },

  async findById(id: string, companyId: string) {
    return prisma.approval.findUnique({
      where: { id, companyId },
      include: {
        client: true,
        attachments: true,
        timeline: { include: { user: true }, orderBy: { createdAt: "desc" } },
      },
    });
  },

  async create(data: {
    title: string;
    description?: string;
    status?: ApprovalStatus;
    dueDate?: Date;
    clientId: string;
    companyId: string;
    projectId?: string;
  }) {
    return prisma.approval.create({ data });
  },

  async update(
    id: string,
    companyId: string,
    data: Partial<{
      title: string;
      description: string;
      status: ApprovalStatus;
      dueDate: Date;
    }>
  ) {
    return prisma.approval.update({ where: { id, companyId }, data });
  },

  async delete(id: string, companyId: string) {
    return prisma.approval.delete({ where: { id, companyId } });
  },

  async addAttachment(
    approvalId: string,
    companyId: string,
    data: { name: string; url: string }
  ) {
    await prisma.approval.findUniqueOrThrow({
      where: { id: approvalId, companyId },
      select: { id: true }
    });
    return prisma.approvalAttachment.create({ data: { ...data, approvalId } });
  },

  async deleteAttachment(id: string, companyId: string) {
    return prisma.approvalAttachment.delete({
      where: {
        id,
        approval: { companyId }
      }
    });
  },

  async addTimeline(
    approvalId: string,
    data: {
      action: string;
      comment?: string;
      status: ApprovalStatus;
      userId?: string;
    }
  ) {
    return prisma.approvalTimeline.create({ data: { ...data, approvalId } });
  },
};
