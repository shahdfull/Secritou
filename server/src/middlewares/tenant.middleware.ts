import type { RequestHandler } from "express";
import { HttpError } from "../utils/httpError.js";

export const requireCompanyTenant = (): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user?.companyId) {
      return next(new HttpError(403, "Company access required"));
    }
    next();
  };
};

export const requireClientTenant = (): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user?.clientId) {
      return next(new HttpError(403, "Client access required"));
    }
    next();
  };
};
