import { Router } from "express";
import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission } from "../middlewares/rbac.middleware.js";
import { analyticsEventRateLimit } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { analyticsEventSchema } from "../validators/analyticsEvent.validator.js";
import { recordEvent, getEventSummary } from "../controllers/analyticsEvent.controller.js";

const router = Router();

// Public ingest: visitors on the landing page aren't authenticated. Body size is
// capped tighter than the app-wide 1mb json limit since events are small and frequent.
router.post(
  "/events",
  analyticsEventRateLimit,
  express.json({ limit: "6kb" }),
  validate(analyticsEventSchema),
  recordEvent,
);

router.get(
  "/events/summary",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  requirePermission("analytics", "read"),
  getEventSummary,
);

export default router;
