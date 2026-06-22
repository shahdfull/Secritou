import type { Role } from "@prisma/client";
import type { RequestHandler } from "express";
import { HttpError } from "../utils/httpError.js";
import { managerPermissionService } from "../services/managerPermission.service.js";

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

export function requirePermission(
  module: string, action: "read" | "create" | "update" | "delete"): RequestHandler {
  return async (req, _res, next) => {
    if (!req.user) {
      next(new HttpError(401, "Authentication required"));
      return;
    }

    if (req.user.role === "ADMIN") {
      next();
      return;
    }

    if (req.user.role !== "MANAGER") {
      next(new HttpError(403, "Insufficient permissions"));
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

