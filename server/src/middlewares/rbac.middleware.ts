import type { Role } from "@prisma/client";
import type { RequestHandler } from "express";
import { HttpError } from "../utils/httpError.js";

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
