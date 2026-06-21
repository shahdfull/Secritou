// Freelancer Application Repository - Data access layer
import { prisma, prismaRead } from "../config/prisma.js";
import type { FreelancerApplication, ApplicationStatus, Prisma } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

function buildOrderBy(orderBy: string | undefined, orderDir: "asc" | "desc") {
  const allowed = ["firstName", "lastName", "email", "createdAt", "status"];
  const field = orderBy && allowed.includes(orderBy) ? orderBy : "createdAt";
  return { [field]: orderDir };
}

function buildWhere(
  companyId: string,
  search?: string,
  status?: ApplicationStatus
): Prisma.FreelancerApplicationWhereInput {
  const textFilter: Prisma.FreelancerApplicationWhereInput = search
    ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  // When filtering by a specific status, scope strictly to that status.
  // Otherwise include both: records owned by this company AND unassigned PENDING
  // records (companyId: null) that are awaiting assignment.
  if (status) {
    const companyFilter: Prisma.FreelancerApplicationWhereInput =
      status === "PENDING"
        ? { companyId: null }
        : { companyId };
    return { ...companyFilter, status, ...textFilter };
  }

  return {
    OR: [{ companyId }, { companyId: null, status: "PENDING" }],
    ...textFilter,
  };
}

export const freelancerApplicationRepository = {
  async findAll(
    companyId: string,
    options: ListQueryOptions & { search?: string; status?: ApplicationStatus }
  ): Promise<PaginatedResult<FreelancerApplication>> {
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir);
    const where = buildWhere(companyId, options.search, options.status);

    const [data, total] = await Promise.all([
      prismaRead.freelancerApplication.findMany({
        where,
        orderBy,
        skip,
        take: options.pageSize,
      }),
      prismaRead.freelancerApplication.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(id: string, companyId: string): Promise<FreelancerApplication | null> {
    return prismaRead.freelancerApplication.findFirst({
      where: { id, companyId },
    });
  },

  async create(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    position: string;
    cvUrl: string;
    portfolioUrl: string;
  }): Promise<FreelancerApplication> {
    // companyId intentionally absent: public route, no auth context at submission time.
    // It is set during acceptApplication() when the admin processes the application.
    return prisma.freelancerApplication.create({ data });
  },

  async update(
    id: string,
    companyId: string,
    data: Partial<{
      status: ApplicationStatus;
      rejectionReason?: string;
      userId?: string;
      companyId?: string;
      accountCreatedAt?: Date;
    }>
  ): Promise<FreelancerApplication> {
    return prisma.freelancerApplication.update({
      where: { id, companyId },
      data,
    });
  },

  async delete(id: string, companyId: string): Promise<FreelancerApplication> {
    return prisma.freelancerApplication.delete({ where: { id, companyId } });
  },

  async findPending(): Promise<FreelancerApplication[]> {
    return prismaRead.freelancerApplication.findMany({
      where: { status: "PENDING", companyId: null },
      orderBy: { createdAt: "desc" },
    });
  },

  async assignToCompany(id: string, companyId: string): Promise<FreelancerApplication> {
    return prisma.freelancerApplication.update({
      where: { id, companyId: null },
      data: { companyId },
    });
  },
};
