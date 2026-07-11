// Service for Tasks - SaaS business logic
import { taskRepository } from "../repositories/task.repository.js";
import { enqueueNotification } from "../jobs/queues.js";
import type { CreateTaskDTO } from "../types/entities.js";
import { HttpError } from "../utils/httpError.js";
import type { Role, TaskStatus } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import type { ServiceScope } from "../utils/serviceScope.js";

// DONE -> REVIEW is allowed so a mistakenly-completed task can be corrected without losing its
// history/comments; DONE has no other way out, forcing a genuinely new scope of work into a new task.
const ALLOWED_TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["TODO", "REVIEW"],
  REVIEW: ["IN_PROGRESS", "DONE"],
  DONE: ["REVIEW"],
};

function assertValidTaskTransition(from: TaskStatus, to: TaskStatus): void {
  const allowed = ALLOWED_TASK_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new HttpError(422, `Cannot transition from ${from} to ${to}. Allowed: ${allowed.join(", ") || "none"}`, "INVALID_TASK_TRANSITION");
  }
}

async function assertProjectInScope(projectId: string, scope?: ServiceScope) {
  if (!scope || scope.userRole !== "MANAGER") return;
  const { prismaRead: prisma } = await import("../config/prisma.js");
  const project = await prisma.project.findFirst({
    where: { id: projectId, serviceId: scope.userServiceId ?? "__none__" },
    select: { id: true },
  });
  if (!project) throw new HttpError(403, "This project is not in your service", "PROJECT_OUT_OF_SCOPE");
}

export interface FreelancerConflict {
  taskId: string;
  title: string;
  startDate: Date;
  dueDate: Date;
  projectId: string;
  projectName: string | null;
}

// Finds this freelancer's other tasks whose [startDate, dueDate] window overlaps the given
// range. Both boundaries are inclusive (a task ending the day another starts counts as a
// conflict), matching how a human reading two date ranges would judge "overlapping". Tasks
// missing either boundary are not assignment-checkable and are excluded from the comparison.
export async function checkFreelancerAvailability(
  freelancerId: string,
  startDate: Date,
  endDate: Date,
  excludeTaskId?: string
): Promise<FreelancerConflict[]> {
  const { prismaRead: prisma } = await import("../config/prisma.js");
  const conflicts = await prisma.task.findMany({
    where: {
      assigneeId: freelancerId,
      ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
      startDate: { not: null, lte: endDate },
      dueDate: { not: null, gte: startDate },
    },
    select: { id: true, title: true, startDate: true, dueDate: true, projectId: true, project: { select: { name: true } } },
  });

  return conflicts.map((c) => ({
    taskId: c.id,
    title: c.title,
    startDate: c.startDate!,
    dueDate: c.dueDate!,
    projectId: c.projectId,
    projectName: c.project?.name ?? null,
  }));
}

export const taskService = {
  async getAllTasks(projectId: string | undefined, userId: string, userRole: Role, options: ListQueryOptions, scope?: ServiceScope) {
    return taskRepository.findAll(userId, userRole, options, projectId, scope?.userServiceId);
  },

  async getFreelancerAvailability(freelancerId: string, startDate: Date, endDate: Date, excludeTaskId?: string) {
    return checkFreelancerAvailability(freelancerId, startDate, endDate, excludeTaskId);
  },

  async getTaskById(id: string, userId: string, userRole: Role, scope?: ServiceScope) {
    const task = await taskRepository.findById(id, userId, userRole, scope?.userServiceId);
    if (!task) throw new HttpError(404, "Task not found");
    return task;
  },

  async createTask(data: CreateTaskDTO, scope?: ServiceScope) {
    await assertProjectInScope(data.projectId, scope);
    const task = await taskRepository.create(data);
    if (data.assigneeId) {
      await enqueueNotification({
        userId: data.assigneeId,
        title: "Nouvelle tâche assignée",
        message: `La tâche "${task.title}" vous a été assignée.`,
        type: "TASK_ASSIGNED",
        entityId: task.id,
        link: `/app/tasks?taskId=${task.id}`,
      });
    }
    const { prismaRead: prisma } = await import("../config/prisma.js");
    const project = await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true, clientId: true } });
    const tagsToInvalidate = [cacheTags.company(), cacheTags.dashboard(), cacheTags.project(data.projectId)];
    if (project?.clientId) tagsToInvalidate.push(cacheTags.client(project.clientId));
    await invalidateTags(tagsToInvalidate);
    return task;
  },

  async updateTask(id: string, data: Partial<CreateTaskDTO>, scope?: ServiceScope) {
    const task = await taskRepository.findByIdAdmin(id);
    if (!task) throw new HttpError(404, "Task not found");
    
    // If user is FREELANCER
    if (scope?.userRole === "FREELANCER") {
      // Check if task is assigned to them
      if (task.assigneeId !== scope.userId) {
        throw new HttpError(403, "You can only update tasks assigned to you", "TASK_NOT_ASSIGNED_TO_YOU");
      }
      // Only allow updating status
      const allowedFields = ["status"];
      const dataKeys = Object.keys(data);
      const hasDisallowedFields = dataKeys.some(key => !allowedFields.includes(key));
      if (hasDisallowedFields) {
        throw new HttpError(403, "You can only update task status as a freelancer", "DISALLOWED_FIELD_UPDATE");
      }
    } else {
      // For ADMIN/MANAGER, enforce project scope
      await assertProjectInScope(task.projectId, scope);
    }

    if (data.status && data.status !== task.status) {
      assertValidTaskTransition(task.status, data.status);
    }

    const updated = await taskRepository.update(id, data);
    if (data.assigneeId && data.assigneeId !== task.assigneeId) {
      await enqueueNotification({
        userId: data.assigneeId,
        title: "Tâche assignée",
        message: `La tâche "${updated.title}" vous a été assignée.`,
        type: "TASK_ASSIGNED",
        entityId: updated.id,
        link: `/app/tasks?taskId=${updated.id}`,
      });
    }
    const { prismaRead: prisma } = await import("../config/prisma.js");
    const project = await prisma.project.findUnique({ where: { id: task.projectId }, select: { id: true, clientId: true } });
    const tagsToInvalidate = [cacheTags.company(), cacheTags.dashboard(), cacheTags.project(task.projectId)];
    if (project?.clientId) tagsToInvalidate.push(cacheTags.client(project.clientId));
    await invalidateTags(tagsToInvalidate);
    return updated;
  },

  async deleteTask(id: string, scope?: ServiceScope) {
    const task = await taskRepository.findByIdAdmin(id);
    if (!task) throw new HttpError(404, "Task not found");
    await assertProjectInScope(task.projectId, scope);
    const { prismaRead: prisma } = await import("../config/prisma.js");
    const project = await prisma.project.findUnique({ where: { id: task.projectId }, select: { id: true, clientId: true } });
    const deleted = await taskRepository.delete(id);
    const tagsToInvalidate = [cacheTags.company(), cacheTags.dashboard(), cacheTags.project(task.projectId)];
    if (project?.clientId) tagsToInvalidate.push(cacheTags.client(project.clientId));
    await invalidateTags(tagsToInvalidate);
    return deleted;
  },
};
