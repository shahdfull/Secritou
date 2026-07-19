import { projectTemplateRepository } from "../repositories/projectTemplate.repository.js";
import { projectRepository } from "../repositories/project.repository.js";
import { HttpError } from "../utils/httpError.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import type { ServiceScope } from "../utils/serviceScope.js";
import { prisma } from "../config/prisma.js";
import { Prisma } from "@prisma/client";

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
    if (template.tasks.length === 0) return [];

    // Idempotence guard (SEC-043) + SEC-073: applying a template is meaningful only on a project
    // with no tasks yet. The count check and the batch insert are wrapped in a single Serializable
    // transaction (same pattern as auth.service.ts#resetPassword) so two strictly concurrent calls
    // can never both read count=0 before either has inserted — one succeeds, the other gets a
    // serialization failure, mapped below to the same 409 the sequential case already returns.
    try {
      const tasks = await prisma.$transaction(async (tx) => {
        const existingTaskCount = await tx.task.count({ where: { projectId } });
        if (existingTaskCount > 0) {
          throw new HttpError(409, "This project already has tasks; a template can only seed an empty project", "TEMPLATE_ALREADY_APPLIED");
        }

        await tx.task.createMany({
          data: template.tasks.map((t) => ({
            title: t.title,
            description: t.description ?? undefined,
            projectId,
          })),
        });
        return tx.task.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: template.tasks.length });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      await invalidateTags([cacheTags.dashboard()]);
      return tasks;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
        throw new HttpError(409, "This project already has tasks; a template can only seed an empty project", "TEMPLATE_ALREADY_APPLIED");
      }
      throw err;
    }
  },
};
