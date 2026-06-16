// Freelancer Repository - Data access layer
import { prisma } from "../config/prisma.js";
import type { FreelancerProfile, Skill } from "@prisma/client";

export const freelancerRepository = {
  async findAllPublic(): Promise<(FreelancerProfile & { user: { id: string; name: string; email: string }; skills: Skill[] })[]> {
    return prisma.freelancerProfile.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        skills: true,
      },
    });
  },

  async findById(id: string): Promise<(FreelancerProfile & { user: { id: string; name: string; email: string }; skills: Skill[] }) | null> {
    return prisma.freelancerProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        skills: true,
      },
    });
  },

  async findByUserId(userId: string): Promise<(FreelancerProfile & { user: { id: string; name: string; email: string }; skills: Skill[] }) | null> {
    return prisma.freelancerProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        skills: true,
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
    const updateData: any = {
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
