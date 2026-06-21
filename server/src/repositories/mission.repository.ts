// Mission Repository - Data access layer
import { prismaRead as prisma } from "../config/prisma.js";
import type { FreelancerMission, MissionStatus } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";
import { buildOrderBy } from "../utils/listQuery.js";

const SORTABLE_FIELDS = ["title", "status", "budget", "createdAt"];

const missionCompanySelect = {
  id: true,
  name: true,
} as const;

const missionFreelancerSelect = {
  id: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

const missionProjectSelect = {
  id: true,
  name: true,
} as const;

const missionListSelect = {
  id: true,
  title: true,
  description: true,
  budget: true,
  status: true,
  paymentStatus: true,
  paidAmount: true,
  paidAt: true,
  paymentNote: true,
  companyId: true,
  freelancerId: true,
  projectId: true,
  createdAt: true,
  updatedAt: true,
  freelancer: { select: missionFreelancerSelect },
  project: { select: missionProjectSelect },
  _count: { select: { applications: true } },
} as const;

const missionPublicSelect = {
  id: true,
  title: true,
  description: true,
  budget: true,
  status: true,
  paymentStatus: true,
  paidAmount: true,
  paidAt: true,
  paymentNote: true,
  companyId: true,
  freelancerId: true,
  projectId: true,
  createdAt: true,
  updatedAt: true,
  company: { select: missionCompanySelect },
  freelancer: { select: missionFreelancerSelect },
  project: { select: missionProjectSelect },
  _count: { select: { applications: true } },
} as const;

export const missionRepository = {
  async findAllByCompany(companyId: string, options: ListQueryOptions, extraWhere?: object): Promise<PaginatedResult<any>> {
    const where = { companyId, ...extraWhere };
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir, SORTABLE_FIELDS, "createdAt");

    const [data, total] = await Promise.all([
      prisma.freelancerMission.findMany({
        where,
        select: missionListSelect,
        orderBy,
        skip,
        take: options.pageSize,
      }),
      prisma.freelancerMission.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findAllOpen(options: ListQueryOptions): Promise<PaginatedResult<any>> {
    const where = { status: "OPEN" as const };
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir, SORTABLE_FIELDS, "createdAt");

    const [data, total] = await Promise.all([
      prisma.freelancerMission.findMany({
        where,
        select: missionPublicSelect,
        orderBy,
        skip,
        take: options.pageSize,
      }),
      prisma.freelancerMission.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(id: string): Promise<any | null> {
    return prisma.freelancerMission.findUnique({
      where: { id },
      select: missionPublicSelect,
    });
  },

  async create(data: {
    title: string;
    description?: string;
    budget?: number;
    companyId: string;
    projectId?: string;
  }): Promise<FreelancerMission> {
    return prisma.freelancerMission.create({
      data: {
        title: data.title,
        description: data.description,
        budget: data.budget ? String(data.budget) : undefined,
        companyId: data.companyId,
        projectId: data.projectId,
      },
    });
  },

  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      budget?: number;
      status?: MissionStatus;
      freelancerId?: string;
    }
  ): Promise<FreelancerMission> {
    return prisma.freelancerMission.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        budget: data.budget ? String(data.budget) : undefined,
        status: data.status,
        freelancerId: data.freelancerId,
      },
    });
  },

  async delete(id: string): Promise<FreelancerMission> {
    return prisma.freelancerMission.delete({ where: { id } });
  },
};
