import { projectTemplateRepository } from "../repositories/projectTemplate.repository.js";
import { projectRepository } from "../repositories/project.repository.js";
import { HttpError } from "../utils/httpError.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import type { ServiceScope } from "../utils/serviceScope.js";

export const projectTemplateService = {
  async getForService(serviceId: string) {
    return projectTemplateRepository.findByServiceId(serviceId);
  },

  // Applies the pole's template to a project — an explicit action taken from the
  // project's empty-tasks state, never auto-triggered at project creation.
  async applyToProject(projectId: string, scope?: ServiceScope) {
    const project = await projectRepository.findByIdAdmin(projectId);
    if (!project) throw new HttpError(404, "Project not found");
    // SEC (session 2026-07-18): project is already loaded with its serviceId here — no need for
    // a second query like task.service.ts's assertProjectInScope. A Manager outside this
    // project's pole could otherwise bulk-inject their own pole's template tasks into it.
    if (scope && scope.userRole === "MANAGER" && project.serviceId !== (scope.userServiceId ?? "__none__")) {
      throw new HttpError(403, "This project is not in your service", "PROJECT_OUT_OF_SCOPE");
    }
    if (project.status === "COMPLETED") {
      throw new HttpError(409, "This project is completed and no longer accepts task changes", "PROJECT_COMPLETED");
    }
    if (!project.serviceId) throw new HttpError(422, "Project has no service/pole assigned", "PROJECT_NO_SERVICE");

    const template = await projectTemplateRepository.findByServiceId(project.serviceId);
    if (!template) throw new HttpError(404, "No template configured for this pole", "TEMPLATE_NOT_FOUND");

    const tasks = await projectTemplateRepository.applyToProject(template.id, projectId);
    await invalidateTags([cacheTags.dashboard()]);
    return tasks;
  },
};
