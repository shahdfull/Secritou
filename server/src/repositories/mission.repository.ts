// Mission Repository - Data access layer
import { prisma } from "../config/prisma.js";
import type { FreelancerMission } from "@prisma/client";

export const missionRepository = {
  async findAllByCompany(companyId: string): Promise<any[]> {
    return prisma.freelancerMission.findMany({
      where: { companyId },
      include: {
        freelancer: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        project: { select: { id: true, name: true } },
      },
    });
  },

  async findAllOpen(): Promise<any[]> {
    return prisma.freelancerMission.findMany({
      where: { status: "OPEN" },
      include: {
        company: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });
  },

  async findById(id: string): Promise<any | null> {
    return prisma.freelancerMission.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        freelancer: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        project: { select: { id: true, name: true } },
      },
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
      status?: any;
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
