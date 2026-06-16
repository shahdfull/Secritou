// Service for Projects - SaaS business logic
import { projectRepository } from "../repositories/project.repository.js";
import type { CreateProjectDTO } from "../types/entities.js";
import { HttpError } from "../utils/httpError.js";
import type { Role } from "@prisma/client";

export const projectService = {
  async getAllProjects(companyId: string, userId: string, userRole: Role, clientId?: string) {
    return projectRepository.findAll(companyId, userId, userRole, clientId);
  },

  async getProjectById(id: string, companyId: string, userId: string, userRole: Role, clientId?: string) {
    const project = await projectRepository.findById(id, companyId, userId, userRole, clientId);
    if (!project) throw new HttpError(404, "Project not found");
    return project;
  },

  async createProject(data: CreateProjectDTO, companyId: string) {
    return projectRepository.create({ ...data, companyId });
  },

  async updateProject(id: string, data: Partial<CreateProjectDTO>, companyId: string) {
    // Only ADMIN can update/delete projects
    const project = await projectRepository.findByIdAdmin(id, companyId);
    if (!project) throw new HttpError(404, "Project not found");
    return projectRepository.update(id, companyId, data);
  },

  async deleteProject(id: string, companyId: string) {
    // Only ADMIN can update/delete projects
    const project = await projectRepository.findByIdAdmin(id, companyId);
    if (!project) throw new HttpError(404, "Project not found");
    return projectRepository.delete(id, companyId);
  },
};
