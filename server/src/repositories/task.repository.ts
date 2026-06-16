// Task Repository - Data access layer
import { prisma } from "../config/prisma.js";
import type { Task, TaskStatus, Role } from "@prisma/client";

export const taskRepository = {
  async findAll(companyId: string, userId: string, userRole: Role, projectId?: string): Promise<Task[]> {
    if (userRole === "ADMIN") {
      return prisma.task.findMany({
        where: { project: { companyId }, ...(projectId && { projectId }) },
        include: { project: true, assignee: true },
      });
    } else if (userRole === "FREELANCER") {
      return prisma.task.findMany({
        where: { 
          project: { companyId }, 
          ...(projectId && { projectId }),
          assigneeId: userId 
        },
        include: { project: true, assignee: true },
      });
    } else { // CLIENT
      return prisma.task.findMany({
        where: { project: { companyId }, ...(projectId && { projectId }) },
        include: { project: true, assignee: true },
      });
    }
  },

  async findById(id: string, companyId: string, userId: string, userRole: Role): Promise<Task | null> {
    if (userRole === "ADMIN") {
      return prisma.task.findFirst({
        where: { id, project: { companyId } },
        include: { project: true, assignee: true },
      });
    } else if (userRole === "FREELANCER") {
      return prisma.task.findFirst({
        where: { id, project: { companyId }, assigneeId: userId },
        include: { project: true, assignee: true },
      });
    } else { // CLIENT
      return prisma.task.findFirst({
        where: { id, project: { companyId } },
        include: { project: true, assignee: true },
      });
    }
  },

  async findByIdAdmin(id: string, companyId: string): Promise<Task | null> {
    return prisma.task.findFirst({
      where: { id, project: { companyId } },
      include: { project: true, assignee: true },
    });
  },

  async create(data: {
    title: string;
    description?: string;
    status?: TaskStatus;
    dueDate?: Date;
    projectId: string;
    assigneeId?: string;
  }): Promise<Task> {
    return prisma.task.create({
      data,
      include: { project: true, assignee: true },
    });
  },

  async update(
    id: string,
    companyId: string,
    data: Partial<{
      title?: string;
      description?: string;
      status?: TaskStatus;
      dueDate?: Date;
      assigneeId?: string;
    }>
  ): Promise<Task> {
    const task = await prisma.task.findFirst({
      where: { id, project: { companyId } },
    });
    if (!task) {
      throw new Error("Task not found");
    }
    return prisma.task.update({
      where: { id },
      data,
      include: { project: true, assignee: true },
    });
  },

  async delete(id: string, companyId: string): Promise<Task> {
    const task = await prisma.task.findFirst({
      where: { id, project: { companyId } },
    });
    if (!task) {
      throw new Error("Task not found");
    }
    return prisma.task.delete({ 
      where: { id },
      include: { project: true, assignee: true }
    });
  },
};
