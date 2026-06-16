// Service for Tasks - SaaS business logic
import { taskRepository } from "../repositories/task.repository.js";
import type { CreateTaskDTO } from "../types/entities.js";
import { HttpError } from "../utils/httpError.js";
import type { Role } from "@prisma/client";

export const taskService = {
  async getAllTasks(projectId: string | undefined, companyId: string, userId: string, userRole: Role) {
    return taskRepository.findAll(companyId, userId, userRole, projectId);
  },

  async getTaskById(id: string, companyId: string, userId: string, userRole: Role) {
    const task = await taskRepository.findById(id, companyId, userId, userRole);
    if (!task) throw new HttpError(404, "Task not found");
    return task;
  },

  async createTask(data: CreateTaskDTO, companyId: string) {
    return taskRepository.create(data);
  },

  async updateTask(id: string, data: Partial<CreateTaskDTO>, companyId: string) {
    const task = await taskRepository.findByIdAdmin(id, companyId);
    if (!task) throw new HttpError(404, "Task not found");
    return taskRepository.update(id, companyId, data);
  },

  async deleteTask(id: string, companyId: string) {
    const task = await taskRepository.findByIdAdmin(id, companyId);
    if (!task) throw new HttpError(404, "Task not found");
    return taskRepository.delete(id, companyId);
  },
};
