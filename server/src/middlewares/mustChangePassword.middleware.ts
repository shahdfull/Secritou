import type { RequestHandler } from "express";
import { HttpError } from "../utils/httpError.js";

export const enforceMustChangePassword: RequestHandler = (req, _res, next) => {
  if (req.user?.mustChangePassword) {
    return next(new HttpError(403, "Password change required", "MUST_CHANGE_PASSWORD"));
  }
  next();
};
