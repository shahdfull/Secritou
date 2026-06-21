import { prisma, prismaRead } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import type { ServiceRequest, ServiceRequestStatus } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";
import { buildOrderBy, buildTextSearchFilter } from "../utils/listQuery.js";
import { HttpError } from "../utils/httpError.js";

const SORTABLE_FIELDS = ["title", "status", "priority", "createdAt", "updatedAt"];

const listSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  clientId: true,
  companyId: true,
  assignedToId: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { name: true, id: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  proposal: { select: { id: true, title: true } },
} as const;

const detailSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  clientId: true,
  companyId: true,
  assignedToId: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { name: true, id: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  proposal: { select: { id: true, title: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      body: true,
      isInternal: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { id: true, name: true, role: true } },
    },
  },
  history: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      field: true,
      oldValue: true,
      newValue: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
    },
  },
} as const;

export const serviceRequestRepository = {
  // ── Client-facing ────────────────────────────────────────────────────────────

  async findAllByClientId(
    clientId: string,
    options: ListQueryOptions
  ): Promise<PaginatedResult<ServiceRequest>> {
    const where = { clientId };
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir, SORTABLE_FIELDS, "createdAt");

    const [data, total] = await Promise.all([
      prismaRead.serviceRequest.findMany({ where, orderBy, skip, take: options.pageSize }),
      prismaRead.serviceRequest.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  // ── Admin / Manager facing ────────────────────────────────────────────────────

  async findAllByCompanyId(
    companyId: string,
    options: ListQueryOptions & {
      status?: ServiceRequestStatus;
      clientId?: string;
      assignedToId?: string;
      priority?: string;
    }
  ): Promise<PaginatedResult<Prisma.ServiceRequestGetPayload<{ select: typeof listSelect }>>> {
    const textFilter = buildTextSearchFilter(options.search, ["title", "description"]);

    const where: Record<string, unknown> = {
      companyId,
      ...textFilter,
      ...(options.status ? { status: options.status } : {}),
      ...(options.clientId ? { clientId: options.clientId } : {}),
      ...(options.assignedToId ? { assignedToId: options.assignedToId } : {}),
      ...(options.priority ? { priority: options.priority } : {}),
    };

    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir, SORTABLE_FIELDS, "createdAt");

    const [data, total] = await Promise.all([
      prismaRead.serviceRequest.findMany({
        where,
        orderBy,
        skip,
        take: options.pageSize,
        select: listSelect,
      }),
      prismaRead.serviceRequest.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(id: string, companyId?: string) {
    return prismaRead.serviceRequest.findFirst({
      where: { id, ...(companyId ? { companyId } : {}) },
      select: detailSelect,
    });
  },

  async findByIdSimple(id: string, companyId?: string): Promise<ServiceRequest | null> {
    return prismaRead.serviceRequest.findFirst({
      where: { id, ...(companyId ? { companyId } : {}) },
    });
  },

  async create(data: {
    title: string;
    description?: string;
    clientId: string;
    companyId: string;
  }): Promise<ServiceRequest> {
    return prisma.serviceRequest.create({ data });
  },

  async update(
    id: string,
    companyId: string,
    data: Partial<{
      title: string;
      description: string;
      status: ServiceRequestStatus;
      priority: string;
      assignedToId: string | null;
    }>
  ) {
    const result = await prisma.serviceRequest.updateMany({
      where: { id, companyId },
      data,
    });
    if (result.count === 0) throw new HttpError(404, "Service request not found");
    return this.findById(id, companyId);
  },

  async delete(id: string, companyId: string): Promise<ServiceRequest> {
    const request = await prisma.serviceRequest.findFirst({ where: { id, companyId } });
    if (!request) throw new HttpError(404, "Service request not found");
    await prisma.serviceRequest.delete({ where: { id } });
    return request;
  },

  // ── Comments ──────────────────────────────────────────────────────────────────

  async addComment(data: {
    serviceRequestId: string;
    authorId: string;
    body: string;
    isInternal: boolean;
  }) {
    return prisma.serviceRequestComment.create({
      data,
      select: {
        id: true,
        body: true,
        isInternal: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, name: true, role: true } },
      },
    });
  },

  async deleteComment(id: string, authorId: string) {
    const comment = await prisma.serviceRequestComment.findUnique({ where: { id } });
    if (!comment) throw new HttpError(404, "Comment not found");
    if (comment.authorId !== authorId) throw new HttpError(403, "Cannot delete another user's comment");
    return prisma.serviceRequestComment.delete({ where: { id } });
  },

  // ── History ───────────────────────────────────────────────────────────────────

  async addHistory(data: {
    serviceRequestId: string;
    userId?: string;
    field: string;
    oldValue?: string | null;
    newValue?: string | null;
  }) {
    return prisma.serviceRequestHistory.create({ data });
  },
};
