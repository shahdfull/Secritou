import type { Role } from "@prisma/client";
import type { RequestHandler } from "express";
import { HttpError } from "../utils/httpError.js";
import { managerPermissionService } from "../services/managerPermission.service.js";
import { clientRepository } from "../repositories/client.repository.js";

export function authorize(...allowedRoles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new HttpError(401, "Authentication required"));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new HttpError(403, "Insufficient permissions"));
      return;
    }

    next();
  };
}

// Cadrage §6: the client portal only opens once the first-tranche deposit is actually paid
// (see invoice.service.ts addPayment, which sets Client.portalActivatedAt). A CLIENT account
// can exist and log in beforehand (so the invitation/welcome-document flow works), but every
// portal data route must be gated behind this check. No-op for non-CLIENT roles so it's safe
// to drop into routes shared with ADMIN/MANAGER/FREELANCER.
export const requireActivatedPortal: RequestHandler = async (req, _res, next) => {
  if (!req.user) {
    next(new HttpError(401, "Authentication required"));
    return;
  }
  if (req.user.role !== "CLIENT") {
    next();
    return;
  }
  if (!req.user.clientId) {
    next(new HttpError(403, "No client account associated with this user"));
    return;
  }
  const activatedAt = await clientRepository.getPortalActivatedAt(req.user.clientId);
  if (!activatedAt) {
    next(new HttpError(403, "Your client portal is not yet active — it opens once the first invoice deposit is paid", "PORTAL_NOT_ACTIVATED"));
    return;
  }
  next();
};

export function requirePermission(
  module: string, action: "read" | "create" | "update" | "delete"): RequestHandler {
  return async (req, _res, next) => {
    if (!req.user) {
      next(new HttpError(401, "Authentication required"));
      return;
    }

    // ADMIN is always allowed; non-MANAGER roles pass through (their access is
    // controlled by the preceding authorize() call on the route).
    if (req.user.role !== "MANAGER") {
      next();
      return;
    }

    const permissions = await managerPermissionService.resolvePermissions(req.user.sub);
    if (permissions[module]?.[action]) {
      next();
      return;
    }

    next(new HttpError(403, `Permission missing: ${module}.${action}`));
  };
}

