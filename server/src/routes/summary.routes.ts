import express from "express";
import {
  getClientSummary,
  getProjectSummary,
  getEnhancedDashboardSummary,
} from "../controllers/summary.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requireActivatedPortal } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { getClientSummarySchema, getProjectSummarySchema } from "../validators/summary.validator.js";
const router = express.Router();

router.use(authenticate);

router.get("/dashboard", authorize("ADMIN", "MANAGER"), getEnhancedDashboardSummary);
router.get(
  "/clients/:clientId",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requireActivatedPortal,
  validate(getClientSummarySchema),
  getClientSummary
);
router.get(
  "/projects/:projectId",
  authorize("ADMIN", "MANAGER", "CLIENT", "FREELANCER"),
  requireActivatedPortal,
  validate(getProjectSummarySchema),
  getProjectSummary
);

export default router;
