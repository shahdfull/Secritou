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

export const taskService = {
  async getAllTasks(
    projectId: string | undefined,
    companyId: string,
    userId: string,
    userRole: Role,
    options: ListQueryOptions
  ) {
    return taskRepository.findAll(companyId, userId, userRole, options, projectId);
  },

  async getTaskById(id: string, companyId: string, userId: string, userRole: Role) {
    const task = await taskRepository.findById(id, companyId, userId, userRole);
    if (!task) throw new HttpError(404, "Task not found");
    return task;
  },

  async createTask(data: CreateTaskDTO, companyId: string) {
    await tenantValidation.assertProjectInCompany(data.projectId, companyId);
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
    await invalidateTags([cacheTags.company(companyId), cacheTags.dashboard(companyId)]);
    return task;
  },

  async updateTask(id: string, data: Partial<CreateTaskDTO>, companyId: string) {
    const task = await taskRepository.findByIdAdmin(id, companyId);
    if (!task) throw new HttpError(404, "Task not found");
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
    await invalidateTags([cacheTags.company(companyId), cacheTags.dashboard(companyId)]);
    return updated;
  },

  async deleteTask(id: string, companyId: string) {
    const task = await taskRepository.findByIdAdmin(id, companyId);
    if (!task) throw new HttpError(404, "Task not found");
    const deleted = await taskRepository.delete(id, companyId);
    await invalidateTags([cacheTags.company(companyId), cacheTags.dashboard(companyId)]);
    return deleted;
  },
};
