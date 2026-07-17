import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission } from "../middlewares/rbac.middleware.js";
import { dashboardCache } from "../middlewares/cache.middleware.js";
import { getDashboardSummary, getFullDashboard } from "../controllers/dashboard.controller.js";
import { getExecutiveMetrics } from "../controllers/executiveMetrics.controller.js";
import { getRevenueForecast } from "../controllers/revenueForecast.controller.js";

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

// SEC-017 (ANOMALIES.yaml) : ces deux endpoints existaient déjà (controller + service +
// repository, complets) mais n'étaient montés sur aucune route — activés ici sur décision
// du porteur du projet, session du 2026-07-17.
dashboardRoutes.get(
  "/executive-metrics",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  requirePermission("analytics", "read"),
  getExecutiveMetrics,
);

dashboardRoutes.get(
  "/revenue-forecast",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  requirePermission("analytics", "read"),
  getRevenueForecast,
);
