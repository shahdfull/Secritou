import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

export const metricsAuthMiddleware: RequestHandler = (req, _res, next) => {
  if (!env.METRICS_TOKEN) {
    next(new HttpError(503, "Metrics endpoint disabled : set METRICS_TOKEN to enable"));
    return;
  }

  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : req.headers["x-metrics-token"];

  if (token !== env.METRICS_TOKEN) {
    next(new HttpError(401, "Unauthorized"));
    return;
  }

  next();
};
