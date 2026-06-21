import type { RequestHandler } from "express";
import { dashboardService } from "../services/dashboard.service.js";

export const getDashboardSummary: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user!.companyId!;
    const data = await dashboardService.getSummary(companyId);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

export const getFullDashboard: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user!.companyId!;
    const data = await dashboardService.getFullDashboard(companyId);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};
