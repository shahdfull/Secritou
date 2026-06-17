import { prisma, prismaRead } from "../config/prisma.js";
import type { ServiceRequest } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";
import { buildOrderBy } from "../utils/listQuery.js";
import { HttpError } from "../utils/httpError.js";

const SORTABLE_FIELDS = ["title", "status", "createdAt"];

export const serviceRequestRepository = {
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

  async findAllByCompanyId(
    companyId: string,
    options: ListQueryOptions
  ): Promise<PaginatedResult<ServiceRequest>> {
    const where = { companyId };
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir, SORTABLE_FIELDS, "createdAt");

    const [data, total] = await Promise.all([
      prismaRead.serviceRequest.findMany({ where, orderBy, skip, take: options.pageSize }),
      prismaRead.serviceRequest.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(id: string, companyId?: string): Promise<ServiceRequest | null> {
    return prismaRead.serviceRequest.findFirst({
      where: {
        id,
        ...(companyId ? { companyId } : {}),
      },
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
      title?: string;
      description?: string;
      status?: "NEW" | "IN_PROGRESS" | "DONE";
    }>
  ): Promise<ServiceRequest> {
    const result = await prisma.serviceRequest.updateMany({
      where: { id, companyId },
      data,
    });
    if (result.count === 0) {
      throw new HttpError(404, "Service request not found");
    }
    const request = await prismaRead.serviceRequest.findFirst({ where: { id, companyId } });
    if (!request) {
      throw new HttpError(404, "Service request not found");
    }
    return request;
  },

  async delete(id: string, companyId: string): Promise<ServiceRequest> {
    const request = await prisma.serviceRequest.findFirst({ where: { id, companyId } });
    if (!request) {
      throw new HttpError(404, "Service request not found");
    }
    const result = await prisma.serviceRequest.deleteMany({ where: { id, companyId } });
    if (result.count === 0) {
      throw new HttpError(404, "Service request not found");
    }
    return request;
  },
};
