import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission } from "../middlewares/rbac.middleware.js";
import { dashboardCache } from "../middlewares/cache.middleware.js";
import { getDashboardSummary, getFullDashboard } from "../controllers/dashboard.controller.js";

export const dashboardRoutes = Router();

dashboardRoutes.get(
  "/summary",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  requirePermission("analytics", "read"),
  dashboardCache,
  getDashboardSummary,
);

dashboardRoutes.get(
  "/full",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  requirePermission("analytics", "read"),
  getFullDashboard,
);
