import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { JwtPayload } from "../types/auth.js";
import { HttpError } from "../utils/httpError.js";

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    next(new HttpError(401, "Authentication required"));
    return;
  }

  try {
    req.user = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired token"));
  }
};
