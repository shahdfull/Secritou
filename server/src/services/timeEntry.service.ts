import { timeEntryRepository } from "../repositories/timeEntry.repository.js";
import { HttpError } from "../utils/httpError.js";
import { prismaRead } from "../config/prisma.js";
import type { Role } from "@prisma/client";
import { assertProjectInScope, type ServiceScope } from "../utils/serviceScope.js";

export const timeEntryService = {
  async create(
    projectId: string,
    userId: string,
    userRole: Role,
    data: { taskId?: string; description?: string; minutes: number; date: Date },
    scope?: ServiceScope
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
    // SEC-020: MANAGER was never scoped to their own pôle here — assertProjectInScope is a no-op
    // for ADMIN/FREELANCER, matching the pattern already used by task.service.ts/
    // projectMeeting.service.ts/projectTemplate.service.ts.
    await assertProjectInScope(projectId, scope);

    if (data.taskId) {
      const task = await prismaRead.task.findFirst({
        where: {
          id: data.taskId,
          projectId,
          // SEC-021: a FREELANCER staffed on the project (has ≥1 assigned task there) could
          // otherwise log time against a colleague's task on the same project — restrict the
          // taskId itself to their own assignment, same restriction task.service.ts#updateTask
          // already applies to a FREELANCER acting on a task directly.
          ...(userRole === "FREELANCER" ? { assigneeId: userId } : {}),
        },
        select: { id: true },
      });
      if (!task) throw new HttpError(404, "Task not found in this project");
    }

    return timeEntryRepository.create({ projectId, userId, ...data });
  },

  async list(projectId: string, page = 1, pageSize = 20, userId?: string, userRole?: Role, scope?: ServiceScope) {
    await assertProjectInScope(projectId, scope);
    const ownOnly = userRole === "FREELANCER" ? userId : undefined;
    return timeEntryRepository.findByProject(projectId, page, pageSize, ownOnly);
  },

  async summary(projectId: string) {
    return timeEntryRepository.getSummaryByProject(projectId);
  },

  async mySummary(projectId: string, userId: string, scope?: ServiceScope) {
    await assertProjectInScope(projectId, scope);
    return timeEntryRepository.getMySummaryByProject(projectId, userId);
  },

  async globalSummary(from: Date, to: Date, serviceId?: string) {
    return timeEntryRepository.getTimeSummaryByPeriod(from, to, serviceId);
  },

  async workloadByAssignee(from: Date, to: Date, serviceId?: string) {
    return timeEntryRepository.getWorkloadByAssignee(from, to, serviceId);
  },
};
