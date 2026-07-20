// Builds the service (pole) access scope for the current request. ADMIN is unscoped; a MANAGER
// is restricted to their own service, resolved from the DB (the JWT does not carry serviceId).
import type { Request } from "express";
import type { Role } from "@prisma/client";
import { userRepository } from "../repositories/user.repository.js";
import { HttpError } from "./httpError.js";

export type ServiceScope = { userRole: Role; userServiceId?: string | null; userId?: string };

export async function buildServiceScope(req: Request): Promise<ServiceScope> {
  const role = req.user!.role;
  if (role === "MANAGER") {
    return { userRole: role, userServiceId: await userRepository.findServiceId(req.user!.id), userId: req.user!.id };
  }
  return { userRole: role, userId: req.user!.id };
}

// Extracted from task.service.ts and projectMeeting.service.ts (SEC-036/SEC-040, session
// 2026-07-18/07-19), which each carried an identical copy — factored here so a third caller
// doesn't risk a diverging rewrite. Not used by projectTemplate.service.ts#applyToProject, which
// already has the project loaded (with serviceId) before this would run and checks it inline
// instead of paying for a second query.
export async function assertProjectInScope(projectId: string, scope?: ServiceScope): Promise<void> {
  if (!scope || scope.userRole !== "MANAGER") return;
  const { prismaRead: prisma } = await import("../config/prisma.js");
  const project = await prisma.project.findFirst({
    where: { id: projectId, serviceId: scope.userServiceId ?? "__none__" },
    select: { id: true },
  });
  if (!project) throw new HttpError(403, "This project is not in your service", "PROJECT_OUT_OF_SCOPE");
}

// A COMPLETED or archived project is done: no new tasks and no changes to its existing tasks
// (or their checklist items/comments — SEC-089) should be possible afterwards (COMPLETED is
// reached only via clientApprove, which already requires every task to be DONE — see
// project.service.ts#clientApprove). Extracted from task.service.ts (session 2026-07-20,
// SEC-089) so taskChecklist.service.ts/comment.service.ts can share it instead of leaving the
// guard task-field-only, which let checklist items and comments keep changing on a project the
// task fields themselves already refuse to touch.
export async function assertProjectIsOpenForTaskChanges(projectId: string): Promise<void> {
  const { prismaRead: prisma } = await import("../config/prisma.js");
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { status: true, archivedAt: true, deletedAt: true },
  });
  if (!project) throw new HttpError(404, "Project not found");
  if (project.archivedAt || project.deletedAt) {
    throw new HttpError(409, "This project is archived and no longer accepts task changes", "PROJECT_ARCHIVED");
  }
  if (project.status === "COMPLETED") {
    throw new HttpError(409, "This project is completed and no longer accepts task changes", "PROJECT_COMPLETED");
  }
}
