import express from "express";
import {
  getClientSummary,
  getProjectSummary,
  getEnhancedDashboardSummary,
} from "../controllers/summary.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
const router = express.Router();

router.use(authenticate);

router.get("/dashboard", authorize("ADMIN", "MANAGER"), getEnhancedDashboardSummary);
router.get("/clients/:clientId", authorize("ADMIN", "MANAGER", "CLIENT"), getClientSummary);
router.get("/projects/:projectId", authorize("ADMIN", "MANAGER", "CLIENT", "FREELANCER"), getProjectSummary);

export default router;
