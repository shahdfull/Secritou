import { prisma, prismaRead } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";
import type { FreelancerProfile, Skill, PortfolioItem } from "@prisma/client";

type FreelancerWithRelations = FreelancerProfile & {
  user: { id: string; name: string; email: string };
  skills: Skill[];
  portfolio?: PortfolioItem[];
};

export const freelancerRepository = {
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
    userId: string,
    data: {
      bio?: string;
      hourlyRate?: number;
      availability?: boolean;
      skillIds?: string[];
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

    if (data.skillIds) {
      updateData.skills = {
        set: data.skillIds.map((skillId) => ({ id: skillId })),
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
