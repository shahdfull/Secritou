import { prisma, prismaRead } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import type { ServiceRequest, ServiceRequestStatus, Priority } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";
import { buildOrderBy, buildTextSearchFilter } from "../utils/listQuery.js";
import { HttpError } from "../utils/httpError.js";

const SORTABLE_FIELDS = ["title", "status", "priority", "createdAt", "updatedAt"];

const listSelect = {
  id: true,
  title: true,
  type: true,
  status: true,
  priority: true,
  clientId: true,
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
  type: true,
  description: true,
  status: true,
  priority: true,
  clientId: true,
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
  async findAllByClientId(clientId: string, options: ListQueryOptions) {
    const where = { clientId };
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir, SORTABLE_FIELDS, "createdAt");

    const clientListSelect = {
      id: true,
      title: true,
      description: true,
      type: true,
      status: true,
      priority: true,
      clientId: true,
      createdAt: true,
      updatedAt: true,
      proposal: { select: { id: true, title: true } },
    } as const;

    const [data, total] = await Promise.all([
      prismaRead.serviceRequest.findMany({ where, orderBy, skip, take: options.pageSize, select: clientListSelect }),
      prismaRead.serviceRequest.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findAll(
    options: ListQueryOptions & {
      status?: ServiceRequestStatus;
      clientId?: string;
      assignedToId?: string;
      priority?: Priority;
      type?: "SUPPORT" | "NEW_PROJECT";
      serviceId?: string | null;
    }
  ): Promise<PaginatedResult<Prisma.ServiceRequestGetPayload<{ select: typeof listSelect }>>> {
    const textFilter = buildTextSearchFilter(options.search, ["title", "description"]);
    const where: Record<string, unknown> = {
      ...textFilter,
      ...(options.status ? { status: options.status } : {}),
      ...(options.clientId ? { clientId: options.clientId } : {}),
      ...(options.assignedToId ? { assignedToId: options.assignedToId } : {}),
      ...(options.priority ? { priority: options.priority } : {}),
      ...(options.type ? { type: options.type } : {}),
      ...(options.serviceId !== undefined ? { client: { projects: { some: { serviceId: options.serviceId ?? "__none__" } } } } : {}),
    };

    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir, SORTABLE_FIELDS, "createdAt");

    const [data, total] = await Promise.all([
      prismaRead.serviceRequest.findMany({ where, orderBy, skip, take: options.pageSize, select: listSelect }),
      prismaRead.serviceRequest.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(id: string) {
    return prismaRead.serviceRequest.findFirst({ where: { id }, select: detailSelect });
  },

  async findByIdSimple(id: string): Promise<ServiceRequest | null> {
    return prismaRead.serviceRequest.findFirst({ where: { id } });
  },

  async findLinkedProposal(id: string) {
    return prismaRead.proposal.findFirst({ where: { serviceRequestId: id }, select: { id: true } });
  },

  async create(data: {
    title: string;
    description?: string;
    type?: "SUPPORT" | "NEW_PROJECT";
    clientId: string;
  }): Promise<ServiceRequest> {
    return prisma.serviceRequest.create({ data });
  },

  async update(id: string, data: Partial<{
    title: string;
    description: string;
    status: ServiceRequestStatus;
    priority: Priority;
    assignedToId: string | null;
    type: "SUPPORT" | "NEW_PROJECT";
  }>) {
    const result = await prisma.serviceRequest.updateMany({ where: { id }, data });
    if (result.count === 0) throw new HttpError(404, "Service request not found");
    return this.findById(id);
  },

  async delete(id: string): Promise<ServiceRequest> {
    const request = await prisma.serviceRequest.findFirst({ where: { id } });
    if (!request) throw new HttpError(404, "Service request not found");
    await prisma.serviceRequest.delete({ where: { id } });
    return request;
  },

  async addComment(data: { serviceRequestId: string; authorId: string; body: string; isInternal: boolean }) {
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

  async addHistory(data: { serviceRequestId: string; userId?: string; field: string; oldValue?: string | null; newValue?: string | null }) {
    return prisma.serviceRequestHistory.create({ data });
  },
};
