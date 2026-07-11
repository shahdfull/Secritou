import { projectTemplateRepository } from "../repositories/projectTemplate.repository.js";
import { projectRepository } from "../repositories/project.repository.js";
import { HttpError } from "../utils/httpError.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";

export const projectTemplateService = {
  async getForService(serviceId: string) {
    return projectTemplateRepository.findByServiceId(serviceId);
  },

  // Applies the pole's template to a project — an explicit action taken from the
  // project's empty-tasks state, never auto-triggered at project creation.
  async applyToProject(projectId: string) {
    const project = await projectRepository.findByIdAdmin(projectId);
    if (!project) throw new HttpError(404, "Project not found");
    if (!project.serviceId) throw new HttpError(422, "Project has no service/pole assigned", "PROJECT_NO_SERVICE");

    const template = await projectTemplateRepository.findByServiceId(project.serviceId);
    if (!template) throw new HttpError(404, "No template configured for this pole", "TEMPLATE_NOT_FOUND");

    const tasks = await projectTemplateRepository.applyToProject(template.id, projectId);
    await invalidateTags([cacheTags.dashboard()]);
    return tasks;
  },
};
