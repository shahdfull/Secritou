// Service for Tasks - SaaS business logic
import { taskRepository } from "../repositories/task.repository.js";
import { enqueueNotification } from "../jobs/queues.js";
import type { CreateTaskDTO } from "../types/entities.js";
import { HttpError } from "../utils/httpError.js";
import type { Role } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import type { ServiceScope } from "../utils/serviceScope.js";

async function assertProjectInScope(projectId: string, scope?: ServiceScope) {
  if (!scope || scope.userRole !== "MANAGER") return;
  const { prismaRead: prisma } = await import("../config/prisma.js");
  const project = await prisma.project.findFirst({
    where: { id: projectId, serviceId: scope.userServiceId ?? "__none__" },
    select: { id: true },
  });
  if (!project) throw new HttpError(403, "This project is not in your service", "PROJECT_OUT_OF_SCOPE");
}

export const taskService = {
  async getAllTasks(projectId: string | undefined, userId: string, userRole: Role, options: ListQueryOptions, scope?: ServiceScope) {
    return taskRepository.findAll(userId, userRole, options, projectId, scope?.userServiceId);
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
      await enqueueNotification({ userId: data.assigneeId, title: "Nouvelle tâche assignée", message: `La tâche "${task.title}" vous a été assignée.` });
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

    const updated = await taskRepository.update(id, data);
    if (data.assigneeId && data.assigneeId !== task.assigneeId) {
      await enqueueNotification({ userId: data.assigneeId, title: "Tâche assignée", message: `La tâche "${updated.title}" vous a été assignée.` });
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
