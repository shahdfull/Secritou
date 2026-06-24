// Freelancer Application Repository - Data access layer
import { prisma, prismaRead } from "../config/prisma.js";
import type { FreelancerApplication, ApplicationStatus, Prisma } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

function buildOrderBy(orderBy: string | undefined, orderDir: "asc" | "desc") {
  const allowed = ["firstName", "lastName", "email", "createdAt", "status"];
  const field = orderBy && allowed.includes(orderBy) ? orderBy : "createdAt";
  return { [field]: orderDir };
}

function buildWhere(search?: string, status?: ApplicationStatus): Prisma.FreelancerApplicationWhereInput {
  const textFilter: Prisma.FreelancerApplicationWhereInput = search
    ? { OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ] }
    : {};

  return { ...(status ? { status } : {}), ...textFilter };
}

export const freelancerApplicationRepository = {
  async findAll(options: ListQueryOptions & { search?: string; status?: ApplicationStatus }): Promise<PaginatedResult<FreelancerApplication>> {
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir);
    const where = buildWhere(options.search, options.status);

    const [data, total] = await Promise.all([
      prismaRead.freelancerApplication.findMany({ where, orderBy, skip, take: options.pageSize }),
      prismaRead.freelancerApplication.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(id: string): Promise<FreelancerApplication | null> {
    return prismaRead.freelancerApplication.findFirst({ where: { id } });
  },

  async create(data: { firstName: string; lastName: string; email: string; phone?: string; position: string; cvUrl: string; portfolioUrl: string }): Promise<FreelancerApplication> {
    return prisma.freelancerApplication.create({ data });
  },

  async update(id: string, data: Partial<{ status: ApplicationStatus; rejectionReason?: string; userId?: string; accountCreatedAt?: Date }>): Promise<FreelancerApplication> {
    return prisma.freelancerApplication.update({ where: { id }, data });
  },

  async delete(id: string): Promise<FreelancerApplication> {
    return prisma.freelancerApplication.delete({ where: { id } });
  },

  async findPending(): Promise<FreelancerApplication[]> {
    return prismaRead.freelancerApplication.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" } });
  },
};
