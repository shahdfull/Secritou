// Service for Tasks - SaaS business logic
import { taskRepository } from "../repositories/task.repository.js";
import { tenantValidation } from "./tenantValidation.service.js";
import { enqueueNotification } from "../jobs/queues.js";
import type { CreateTaskDTO } from "../types/entities.js";
import { HttpError } from "../utils/httpError.js";
import type { Role } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import type { ServiceScope } from "../utils/serviceScope.js";

// A MANAGER may only act on tasks whose project is in their service (pole). Throws 403 if a
// manager (or a manager without a service) targets a project outside their pole. ADMIN: no-op.
async function assertProjectInScope(projectId: string, companyId: string, scope?: ServiceScope) {
  if (!scope || scope.userRole !== "MANAGER") return;
  const { prismaRead: prisma } = await import("../config/prisma.js");
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId, serviceId: scope.userServiceId ?? "__none__" },
    select: { id: true },
  });
  if (!project) {
    throw new HttpError(403, "This project is not in your service", "PROJECT_OUT_OF_SCOPE");
  }
}

export const taskService = {
  async getAllTasks(
    projectId: string | undefined,
    companyId: string,
    userId: string,
    userRole: Role,
    options: ListQueryOptions,
    scope?: ServiceScope
  ) {
    return taskRepository.findAll(companyId, userId, userRole, options, projectId, scope?.userServiceId);
  },

  async getTaskById(id: string, companyId: string, userId: string, userRole: Role, scope?: ServiceScope) {
    const task = await taskRepository.findById(id, companyId, userId, userRole, scope?.userServiceId);
    if (!task) throw new HttpError(404, "Task not found");
    return task;
  },

  async createTask(data: CreateTaskDTO, companyId: string, scope?: ServiceScope) {
    await tenantValidation.assertProjectInCompany(data.projectId, companyId);
    await assertProjectInScope(data.projectId, companyId, scope);
    if (data.assigneeId) {
      await tenantValidation.assertUserInCompany(data.assigneeId, companyId);
    }

    const task = await taskRepository.create(data);
    if (data.assigneeId) {
      await enqueueNotification({
        userId: data.assigneeId,
        title: "Nouvelle tâche assignée",
        message: `La tâche "${task.title}" vous a été assignée.`,
      });
    }
    const { prismaRead: prisma } = await import("../config/prisma.js");
    const project = await prisma.project.findUnique({
      where: { id: data.projectId, companyId },
      select: { id: true, clientId: true },
    });
    const tagsToInvalidate = [
      cacheTags.company(companyId),
      cacheTags.dashboard(companyId),
      cacheTags.project(companyId, data.projectId),
    ];
    if (project?.clientId) tagsToInvalidate.push(cacheTags.client(companyId, project.clientId));
    await invalidateTags(tagsToInvalidate);
    return task;
  },

  async updateTask(id: string, data: Partial<CreateTaskDTO>, companyId: string, scope?: ServiceScope) {
    const task = await taskRepository.findByIdAdmin(id, companyId);
    if (!task) throw new HttpError(404, "Task not found");
    // A manager may only modify a task whose project is in their service.
    await assertProjectInScope(task.projectId, companyId, scope);
    if (data.assigneeId) {
      await tenantValidation.assertUserInCompany(data.assigneeId, companyId);
    }

    const updated = await taskRepository.update(id, companyId, data);
    if (data.assigneeId && data.assigneeId !== task.assigneeId) {
      await enqueueNotification({
        userId: data.assigneeId,
        title: "Tâche assignée",
        message: `La tâche "${updated.title}" vous a été assignée.`,
      });
    }
    const { prismaRead: prisma } = await import("../config/prisma.js");
    const project = await prisma.project.findUnique({
      where: { id: task.projectId, companyId },
      select: { id: true, clientId: true },
    });
    const tagsToInvalidate = [
      cacheTags.company(companyId),
      cacheTags.dashboard(companyId),
      cacheTags.project(companyId, task.projectId),
    ];
    if (project?.clientId) tagsToInvalidate.push(cacheTags.client(companyId, project.clientId));
    await invalidateTags(tagsToInvalidate);
    return updated;
  },

  async deleteTask(id: string, companyId: string, scope?: ServiceScope) {
    const task = await taskRepository.findByIdAdmin(id, companyId);
    if (!task) throw new HttpError(404, "Task not found");
    await assertProjectInScope(task.projectId, companyId, scope);
    const { prismaRead: prisma } = await import("../config/prisma.js");
    const project = await prisma.project.findUnique({
      where: { id: task.projectId, companyId },
      select: { id: true, clientId: true },
    });
    const deleted = await taskRepository.delete(id, companyId);
    const tagsToInvalidate = [
      cacheTags.company(companyId),
      cacheTags.dashboard(companyId),
      cacheTags.project(companyId, task.projectId),
    ];
    if (project?.clientId) tagsToInvalidate.push(cacheTags.client(companyId, project.clientId));
    await invalidateTags(tagsToInvalidate);
    return deleted;
  },
};
