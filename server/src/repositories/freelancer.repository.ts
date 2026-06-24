import { prisma, prismaRead } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";
import type { FreelancerProfile, Skill, PortfolioItem } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";
import { buildTextSearchFilter } from "../utils/listQuery.js";

type FreelancerRaw = FreelancerProfile & {
  user: { id: string; name: string; email: string };
  skills: Skill[];
  portfolio?: PortfolioItem[];
};

export type FreelancerWithRelations = Omit<FreelancerRaw, "hourlyRate" | "rating"> & {
  hourlyRate: number | null;
  rating: number | null;
};

const include = {
  user: { select: { id: true, name: true, email: true } },
  skills: true,
  portfolio: true,
} as const;

function serialize(raw: FreelancerRaw): FreelancerWithRelations {
  return {
    ...raw,
    hourlyRate: raw.hourlyRate != null ? Number(raw.hourlyRate) : null,
    rating: raw.rating != null ? Number(raw.rating) : null,
  };
}

export const freelancerRepository = {
  async findAll(options: ListQueryOptions & { serviceId?: string | null }): Promise<PaginatedResult<FreelancerWithRelations>> {
    const skip = (options.page - 1) * options.pageSize;
    const searchFilter = buildTextSearchFilter(options.search, ["user.name", "bio"]);
    const baseWhere = Object.keys(searchFilter).length
      ? { OR: [{ user: { name: { contains: options.search, mode: "insensitive" as const } } }, { bio: { contains: options.search, mode: "insensitive" as const } }] }
      : {};
    const serviceWhere = options.serviceId !== undefined
      ? { user: { tasks: { some: { project: { serviceId: options.serviceId ?? "__none__" } } } } }
      : {};
    const where = { ...baseWhere, ...serviceWhere };
    const [raw, total] = await Promise.all([
      prismaRead.freelancerProfile.findMany({ where, include, skip, take: options.pageSize, orderBy: { createdAt: "desc" } }),
      prismaRead.freelancerProfile.count({ where }),
    ]);
    return { data: raw.map(serialize), total, page: options.page, pageSize: options.pageSize };
  },

  async findById(id: string): Promise<FreelancerWithRelations | null> {
    const raw = await prismaRead.freelancerProfile.findUnique({ where: { id }, include });
    return raw ? serialize(raw) : null;
  },

  async findByUserId(userId: string): Promise<FreelancerWithRelations | null> {
    const raw = await prismaRead.freelancerProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        skills: true,
        portfolio: true,
      },
    });
    return raw ? serialize(raw) : null;
  },

  async create(data: {
    userId: string;
    bio?: string;
    hourlyRate?: number;
    skillNames?: string[];
  }): Promise<FreelancerProfile & { skills: Skill[] }> {
    let skills = undefined;
    if (data.skillNames && data.skillNames.length > 0) {
      const skillConnectOrCreate = data.skillNames.map((name) => ({
        where: { name },
        create: { name },
      }));
      skills = { connectOrCreate: skillConnectOrCreate };
    }

    return prisma.freelancerProfile.create({
      data: {
        userId: data.userId,
        bio: data.bio,
        hourlyRate: data.hourlyRate ? String(data.hourlyRate) : undefined,
        skills,
      },
      include: { skills: true },
    });
  },

  async update(
    id: string,
    userId: string,
    data: {
      bio?: string;
      hourlyRate?: number;
      availability?: boolean;
      skillNames?: string[];
    }
  ): Promise<FreelancerProfile & { skills: Skill[] }> {
    const existing = await prismaRead.freelancerProfile.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new HttpError(404, `Freelancer ${id} not found or access denied`);

    const updateData: Record<string, unknown> = {
      bio: data.bio,
      hourlyRate: data.hourlyRate ? String(data.hourlyRate) : undefined,
      availability: data.availability,
    };

    if (data.skillNames) {
      const skillConnectOrCreate = data.skillNames.map((name) => ({
        where: { name },
        create: { name },
      }));
      updateData.skills = {
        set: skillConnectOrCreate,
      };
    }

    return prisma.freelancerProfile.update({
      where: { id, userId },
      data: updateData,
      include: { skills: true },
    });
  },

  async delete(id: string, userId: string): Promise<FreelancerProfile> {
    const existing = await prismaRead.freelancerProfile.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new HttpError(404, `Freelancer ${id} not found or access denied`);

    return prisma.freelancerProfile.delete({ where: { id, userId } });
  },
};
