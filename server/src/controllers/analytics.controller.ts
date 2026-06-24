import type { RequestHandler } from "express";
import { analyticsService } from "../services/analytics.service.js";
import { buildServiceScope } from "../utils/serviceScope.js";

export const getSummary: RequestHandler = async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;
    const scope = req.user!.role === "MANAGER" ? await buildServiceScope(req) : undefined;
    const result = await analyticsService.getSummary(from, to, scope?.userServiceId);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};
