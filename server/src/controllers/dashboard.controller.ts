import type { RequestHandler } from "express";
import { dashboardService } from "../services/dashboard.service.js";
import { buildServiceScope } from "../utils/serviceScope.js";

export const getDashboardSummary: RequestHandler = async (req, res, next) => {
  try {
    const scope = req.user!.role === "MANAGER" ? await buildServiceScope(req) : undefined;
    const data = await dashboardService.getSummary(scope?.userServiceId);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

export const getFullDashboard: RequestHandler = async (req, res, next) => {
  try {
    const scope = req.user!.role === "MANAGER" ? await buildServiceScope(req) : undefined;
    const data = await dashboardService.getFullDashboard(scope?.userServiceId);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};
