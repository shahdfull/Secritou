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

const router = express.Router();

// Apply base middleware to all client success routes
router.use(authenticate);

// Protected routes
router.get(
  "/:clientId",
  authorize("ADMIN", "MANAGER"),
  getClientSuccess
);
router.put(
  "/:clientId/score",
  authorize("ADMIN", "MANAGER"),
  validate(updateScoreSchema),
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
  validate(addObjectiveSchema),
  addSuccessObjective
);
router.put(
  "/:clientId/objectives/:objectiveId",
  authorize("ADMIN", "MANAGER"),
  validate(updateObjectiveSchema),
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
  validate(addMetricSchema),
  addSuccessMetric
);
router.put(
  "/:clientId/metrics/:metricId",
  authorize("ADMIN", "MANAGER"),
  validate(updateMetricSchema),
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
  validate(addRecommendationSchema),
  addSuccessRecommendation
);
router.put(
  "/:clientId/recommendations/:recommendationId",
  authorize("ADMIN", "MANAGER"),
  validate(updateRecommendationSchema),
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
  validate(addTimelineSchema),
  addSuccessTimeline
);
router.delete(
  "/:clientId/timeline/:timelineId",
  authorize("ADMIN"),
  deleteSuccessTimeline
);

export default router;
