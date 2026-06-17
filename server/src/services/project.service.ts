// Service for Projects - SaaS business logic
import { projectRepository } from "../repositories/project.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { tenantValidation } from "./tenantValidation.service.js";
import { enqueueNotifications } from "../jobs/queues.js";
import type { CreateProjectDTO } from "../types/entities.js";
import { HttpError } from "../utils/httpError.js";
import type { Role } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";

export const projectService = {
  async getAllProjects(
    companyId: string,
    userId: string,
    userRole: Role,
    options: ListQueryOptions,
    clientId?: string
  ) {
    return projectRepository.findAll(companyId, userId, userRole, options, clientId);
  },

  async getProjectById(id: string, companyId: string, userId: string, userRole: Role, clientId?: string) {
    const project = await projectRepository.findById(id, companyId, userId, userRole, clientId);
    if (!project) throw new HttpError(404, "Project not found");
    return project;
  },

  async createProject(data: CreateProjectDTO, companyId: string) {
    if (data.clientId) {
      await tenantValidation.assertClientInCompany(data.clientId, companyId);
    }
    const project = await projectRepository.create({ ...data, companyId });
    await invalidateTags([cacheTags.company(companyId), cacheTags.dashboard(companyId)]);
    return project;
  },

  async updateProject(id: string, data: Partial<CreateProjectDTO>, companyId: string) {
    const project = await projectRepository.findByIdAdmin(id, companyId);
    if (!project) throw new HttpError(404, "Project not found");
    if (data.clientId) {
      await tenantValidation.assertClientInCompany(data.clientId, companyId);
    }

    const updated = await projectRepository.update(id, companyId, data);

    if (data.status && data.status !== project.status && project.clientId) {
      const clientUsers = await userRepository.findByClientId(project.clientId);
      await enqueueNotifications(
        clientUsers.map((user) => ({
          userId: user.id,
          title: "Mise à jour du projet",
          message: `Le projet "${project.name}" est passé à ${data.status}`,
        })),
      );
    }

    await invalidateTags([cacheTags.company(companyId), cacheTags.dashboard(companyId)]);
    return updated;
  },

  async deleteProject(id: string, companyId: string) {
    const project = await projectRepository.findByIdAdmin(id, companyId);
    if (!project) throw new HttpError(404, "Project not found");
    const deleted = await projectRepository.delete(id, companyId);
    await invalidateTags([cacheTags.company(companyId), cacheTags.dashboard(companyId)]);
    return deleted;
  },
};
