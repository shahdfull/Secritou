// Freelancer Repository - Data access layer
import { prisma, prismaRead } from "../config/prisma.js";
import type { FreelancerProfile, Skill, PortfolioItem } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

type FreelancerWithRelations = FreelancerProfile & {
  user: { id: string; name: string; email: string };
  skills: Skill[];
  portfolio?: PortfolioItem[];
};

function buildOrderBy(orderBy: string | undefined, orderDir: "asc" | "desc") {
  if (orderBy === "name") {
    return { user: { name: orderDir } };
  }
  if (orderBy === "email") {
    return { user: { email: orderDir } };
  }
  const allowed = ["hourlyRate", "createdAt"];
  const field = orderBy && allowed.includes(orderBy) ? orderBy : "createdAt";
  return { [field]: orderDir };
}

export const freelancerRepository = {
  async findAllPublic(options: ListQueryOptions): Promise<PaginatedResult<FreelancerWithRelations>> {
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir);

    const [data, total] = await Promise.all([
      prismaRead.freelancerProfile.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          skills: true,
        },
        orderBy,
        skip,
        take: options.pageSize,
      }),
      prismaRead.freelancerProfile.count(),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(id: string): Promise<FreelancerWithRelations | null> {
    return prismaRead.freelancerProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        skills: true,
        portfolio: true,
      },
    });
  },

  async findByUserId(userId: string): Promise<FreelancerWithRelations | null> {
    return prismaRead.freelancerProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        skills: true,
        portfolio: true,
      },
    });
  },

  async create(data: {
    userId: string;
    bio?: string;
    hourlyRate?: number;
    skillIds?: string[];
  }): Promise<FreelancerProfile & { skills: Skill[] }> {
    return prisma.freelancerProfile.create({
      data: {
        userId: data.userId,
        bio: data.bio,
        hourlyRate: data.hourlyRate ? String(data.hourlyRate) : undefined,
        skills: data.skillIds
          ? { connect: data.skillIds.map((id) => ({ id })) }
          : undefined,
      },
      include: { skills: true },
    });
  },

  async update(
    id: string,
    data: {
      bio?: string;
      hourlyRate?: number;
      availability?: boolean;
      skillIds?: string[];
    }
  ): Promise<FreelancerProfile & { skills: Skill[] }> {
    const updateData: Record<string, unknown> = {
      bio: data.bio,
      hourlyRate: data.hourlyRate ? String(data.hourlyRate) : undefined,
      availability: data.availability,
    };

    if (data.skillIds) {
      updateData.skills = {
        set: data.skillIds.map((id) => ({ id })),
      };
    }

    return prisma.freelancerProfile.update({
      where: { id },
      data: updateData,
      include: { skills: true },
    });
  },

  async delete(id: string): Promise<FreelancerProfile> {
    return prisma.freelancerProfile.delete({ where: { id } });
  },
};
