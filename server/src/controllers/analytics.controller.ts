import type { RequestHandler } from "express";
import { analyticsService } from "../services/analytics.service.js";
import { HttpError } from "../utils/httpError.js";

export const getSummary: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      throw new HttpError(400, "No company associated");
    }
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;
    const result = await analyticsService.getSummary(companyId, from, to);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};
