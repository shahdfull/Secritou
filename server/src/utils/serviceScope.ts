// Builds the service (pole) access scope for the current request. ADMIN is unscoped; a MANAGER
// is restricted to their own service, resolved from the DB (the JWT does not carry serviceId).
import type { Request } from "express";
import type { Role } from "@prisma/client";
import { userRepository } from "../repositories/user.repository.js";

export type ServiceScope = { userRole: Role; userServiceId?: string | null };

export async function buildServiceScope(req: Request): Promise<ServiceScope> {
  const role = req.user!.role;
  if (role === "MANAGER") {
    return { userRole: role, userServiceId: await userRepository.findServiceId(req.user!.id) };
  }
  return { userRole: role };
}
