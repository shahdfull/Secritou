import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireCompanyTenant } from "../middlewares/tenant.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { dashboardCache } from "../middlewares/cache.middleware.js";
import { getDashboardSummary, getFullDashboard } from "../controllers/dashboard.controller.js";

export const dashboardRoutes = Router();

dashboardRoutes.get(
  "/summary",
  authenticate,
  requireCompanyTenant(),
  authorize("ADMIN", "MANAGER"),
  dashboardCache,
  getDashboardSummary,
);

dashboardRoutes.get(
  "/full",
  authenticate,
  requireCompanyTenant(),
  authorize("ADMIN", "MANAGER"),
  getFullDashboard,
);
