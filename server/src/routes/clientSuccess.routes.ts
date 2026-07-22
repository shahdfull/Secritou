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
import { authorize, requirePermission } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  updateScoreSchema,
  addObjectiveSchema,
  updateObjectiveSchema,
  addMetricSchema,
  updateMetricSchema,
  addRecommendationSchema,
  updateRecommendationSchema,
  addTimelineSchema,
} from "../validators/clientSuccess.validator.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

// Apply base middleware to all client success routes
router.use(authenticate);

// Protected routes
router.get(
  "/:clientId",
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-success", "read"),
  getClientSuccess
);
router.put(
  "/:clientId/score",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-success", "update"),
  validate(updateScoreSchema),
  updateClientSuccessScore
);
router.post(
  "/:clientId/calculate-score",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-success", "update"),
  calculateClientSuccessScore
);

// Objectives
router.post(
  "/:clientId/objectives",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-success", "create"),
  validate(addObjectiveSchema),
  addSuccessObjective
);
router.put(
  "/:clientId/objectives/:objectiveId",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-success", "update"),
  validate(updateObjectiveSchema),
  updateSuccessObjective
);
router.delete(
  "/:clientId/objectives/:objectiveId",
  sensitiveWriteRateLimit,
  authorize("ADMIN"),
  deleteSuccessObjective
);

// Metrics
router.post(
  "/:clientId/metrics",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-success", "create"),
  validate(addMetricSchema),
  addSuccessMetric
);
router.put(
  "/:clientId/metrics/:metricId",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-success", "update"),
  validate(updateMetricSchema),
  updateSuccessMetric
);
router.delete(
  "/:clientId/metrics/:metricId",
  sensitiveWriteRateLimit,
  authorize("ADMIN"),
  deleteSuccessMetric
);

// Recommendations
router.post(
  "/:clientId/recommendations",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-success", "create"),
  validate(addRecommendationSchema),
  addSuccessRecommendation
);
router.put(
  "/:clientId/recommendations/:recommendationId",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-success", "update"),
  validate(updateRecommendationSchema),
  updateSuccessRecommendation
);
router.delete(
  "/:clientId/recommendations/:recommendationId",
  sensitiveWriteRateLimit,
  authorize("ADMIN"),
  deleteSuccessRecommendation
);

// Timeline
router.post(
  "/:clientId/timeline",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-success", "create"),
  validate(addTimelineSchema),
  addSuccessTimeline
);
router.delete(
  "/:clientId/timeline/:timelineId",
  sensitiveWriteRateLimit,
  authorize("ADMIN"),
  deleteSuccessTimeline
);

export default router;
