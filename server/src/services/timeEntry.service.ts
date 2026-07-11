import { timeEntryRepository } from "../repositories/timeEntry.repository.js";
import { HttpError } from "../utils/httpError.js";
import { prismaRead } from "../config/prisma.js";
import type { Role } from "@prisma/client";

export const timeEntryService = {
  async create(
    projectId: string,
    userId: string,
    userRole: Role,
    data: { taskId?: string; description?: string; minutes: number; date: Date }
  ) {
    // FREELANCER may only log for themselves — enforced by passing their own userId
    const project = await prismaRead.project.findFirst({
      where: {
        id: projectId,
        archivedAt: null,
        ...(userRole === "FREELANCER" ? { tasks: { some: { assigneeId: userId } } } : {}),
      },
      select: { id: true },
    });
    if (!project) throw new HttpError(404, "Project not found");

    if (data.taskId) {
      const task = await prismaRead.task.findFirst({
        where: { id: data.taskId, projectId },
        select: { id: true },
      });
      if (!task) throw new HttpError(404, "Task not found in this project");
    }

    return timeEntryRepository.create({ projectId, userId, ...data });
  },

  async list(projectId: string, page = 1, pageSize = 20, userId?: string, userRole?: Role) {
    const ownOnly = userRole === "FREELANCER" ? userId : undefined;
    return timeEntryRepository.findByProject(projectId, page, pageSize, ownOnly);
  },

  async summary(projectId: string) {
    return timeEntryRepository.getSummaryByProject(projectId);
  },

  async mySummary(projectId: string, userId: string) {
    return timeEntryRepository.getMySummaryByProject(projectId, userId);
  },

  async globalSummary(from: Date, to: Date, serviceId?: string) {
    return timeEntryRepository.getTimeSummaryByPeriod(from, to, serviceId);
  },

  async workloadByAssignee(from: Date, to: Date, serviceId?: string) {
    return timeEntryRepository.getWorkloadByAssignee(from, to, serviceId);
  },
};
