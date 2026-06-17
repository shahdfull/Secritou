// Mission Application Repository - Data access layer
import { prisma } from "../config/prisma.js";
import type { MissionApplicationStatus } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

const freelancerWithUser = {
  freelancer: {
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  },
} as const;

export const missionApplicationRepository = {
  async create(data: { missionId: string; freelancerId: string }) {
    return prisma.missionApplication.create({
      data,
      include: freelancerWithUser,
    });
  },

  async findByMissionId(
    missionId: string,
    options?: ListQueryOptions
  ): Promise<PaginatedResult<unknown> | unknown[]> {
    if (!options) {
      return prisma.missionApplication.findMany({
        where: { missionId },
        include: freelancerWithUser,
        orderBy: { createdAt: "desc" },
      });
    }

    const skip = (options.page - 1) * options.pageSize;
    const [data, total] = await Promise.all([
      prisma.missionApplication.findMany({
        where: { missionId },
        include: freelancerWithUser,
        orderBy: { createdAt: "desc" },
        skip,
        take: options.pageSize,
      }),
      prisma.missionApplication.count({ where: { missionId } }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(id: string) {
    return prisma.missionApplication.findUnique({
      where: { id },
      include: {
        mission: { select: { id: true, companyId: true, title: true, status: true } },
        ...freelancerWithUser,
      },
    });
  },

  async updateStatus(id: string, status: MissionApplicationStatus) {
    return prisma.missionApplication.update({
      where: { id },
      data: { status },
      include: freelancerWithUser,
    });
  },
};
