// Project Repository - Data access layer
import { prisma } from "../config/prisma.js";
import type { Project, ProjectStatus, Role } from "@prisma/client";

export const projectRepository = {
  async findAll(companyId: string, userId: string, userRole: Role, clientId?: string): Promise<Project[]> {
    if (userRole === "ADMIN") {
      return prisma.project.findMany({
        where: { companyId },
        include: { client: true, tasks: true },
      });
    } else if (userRole === "FREELANCER") {
      return prisma.project.findMany({
        where: { 
          companyId,
          tasks: { some: { assigneeId: userId } }
        },
        include: { client: true, tasks: true },
      });
    } else { // CLIENT
      return prisma.project.findMany({
        where: { companyId, clientId },
        include: { client: true, tasks: true },
      });
    }
  },

  async findById(id: string, companyId: string, userId: string, userRole: Role, clientId?: string): Promise<Project | null> {
    if (userRole === "ADMIN") {
      return prisma.project.findUnique({
        where: { id, companyId },
        include: { client: true, tasks: true },
      });
    } else if (userRole === "FREELANCER") {
      return prisma.project.findFirst({
        where: { 
          id, 
          companyId, 
          tasks: { some: { assigneeId: userId } }
        },
        include: { client: true, tasks: true },
      });
    } else { // CLIENT
      return prisma.project.findUnique({
        where: { id, companyId, clientId },
        include: { client: true, tasks: true },
      });
    }
  },

  async findByIdAdmin(id: string, companyId: string): Promise<Project | null> {
    return prisma.project.findUnique({
      where: { id, companyId },
      include: { client: true, tasks: true },
    });
  },

  async create(data: {
    name: string;
    description?: string;
    status?: ProjectStatus;
    clientId?: string;
    companyId: string;
  }): Promise<Project> {
    return prisma.project.create({ data, include: { client: true } });
  },

  async update(id: string, companyId: string, data: Partial<{
    name?: string;
    description?: string;
    status?: ProjectStatus;
    clientId?: string;
  }>): Promise<Project> {
    return prisma.project.update({ where: { id, companyId }, data, include: { client: true } });
  },

  async delete(id: string, companyId: string): Promise<Project> {
    return prisma.project.delete({ where: { id, companyId } });
  },
};
