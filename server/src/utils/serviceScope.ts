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
