import express from "express";
import {
  getClientSuccess,
  updateClientSuccessScore,
  calculateClientSuccessScore,
  addSuccessObjective,
  updateSuccessObjective,
  deleteSuccessObjective,
  addSuccessMetric,
  updateSuccessMetric,
  deleteSuccessMetric,
  addSuccessRecommendation,
  updateSuccessRecommendation,
  deleteSuccessRecommendation,
  addSuccessTimeline,
  deleteSuccessTimeline,
} from "../controllers/clientSuccess.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { requireCompanyTenant } from "../middlewares/tenant.middleware.js";

const router = express.Router();

// Apply base middleware to all client success routes
router.use(authenticate, requireCompanyTenant());

// Protected routes
router.get(
  "/:clientId",
  authorize("ADMIN", "MANAGER"),
  getClientSuccess
);
router.put(
  "/:clientId/score",
  authorize("ADMIN", "MANAGER"),
  updateClientSuccessScore
);
router.post(
  "/:clientId/calculate-score",
  authorize("ADMIN", "MANAGER"),
  calculateClientSuccessScore
);

// Objectives
router.post(
  "/:clientId/objectives",
  authorize("ADMIN", "MANAGER"),
  addSuccessObjective
);
router.put(
  "/:clientId/objectives/:objectiveId",
  authorize("ADMIN", "MANAGER"),
  updateSuccessObjective
);
router.delete(
  "/:clientId/objectives/:objectiveId",
  authorize("ADMIN"),
  deleteSuccessObjective
);

// Metrics
router.post(
  "/:clientId/metrics",
  authorize("ADMIN", "MANAGER"),
  addSuccessMetric
);
router.put(
  "/:clientId/metrics/:metricId",
  authorize("ADMIN", "MANAGER"),
  updateSuccessMetric
);
router.delete(
  "/:clientId/metrics/:metricId",
  authorize("ADMIN"),
  deleteSuccessMetric
);

// Recommendations
router.post(
  "/:clientId/recommendations",
  authorize("ADMIN", "MANAGER"),
  addSuccessRecommendation
);
router.put(
  "/:clientId/recommendations/:recommendationId",
  authorize("ADMIN", "MANAGER"),
  updateSuccessRecommendation
);
router.delete(
  "/:clientId/recommendations/:recommendationId",
  authorize("ADMIN"),
  deleteSuccessRecommendation
);

// Timeline
router.post(
  "/:clientId/timeline",
  authorize("ADMIN", "MANAGER"),
  addSuccessTimeline
);
router.delete(
  "/:clientId/timeline/:timelineId",
  authorize("ADMIN"),
  deleteSuccessTimeline
);

export default router;
