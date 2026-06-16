import type { RequestHandler } from "express";
import { analyticsService } from "../services/analytics.service.js";
import { HttpError } from "../utils/httpError.js";

export const getSummary: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      throw new HttpError(400, "No company associated");
    }
    const result = await analyticsService.getSummary(companyId);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};
