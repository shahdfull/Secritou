import type { RequestHandler } from "express";
import { dashboardService } from "../services/dashboard.service.js";

export const getDashboardSummary: RequestHandler = async (req, res, next) => {
  try {
    const data = await dashboardService.getSummary();
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

export const getFullDashboard: RequestHandler = async (req, res, next) => {
  try {
    const data = await dashboardService.getFullDashboard();
    res.json({ data });
  } catch (error) {
    next(error);
  }
};
