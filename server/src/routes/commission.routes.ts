import express from "express";
import {
  getProjectCommissionSplits,
  setProjectCommissionSplits,
  setProjectCommissionModeToPerTask,
  getCommissions,
  getCommissionsOwedSummary,
  getMyCommissions,
  getMyCommissionsSummary,
  getMySplitForProject,
  markCommissionPaid,
  resetProjectCommissionSplitToAuto,
  getProjectCommissionSplitHistory,
  setProjectPayoutBudget,
} from "../controllers/commission.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  projectIdParamSchema,
  commissionIdParamSchema,
  setCommissionSplitsSchema,
  setProjectPayoutBudgetSchema,
} from "../validators/commission.validator.js";

const router = express.Router();

router.use(authenticate);

// Self-service: a MANAGER (partner) can see their own commissions/payout summary,
// but not anyone else's — partnerId is forced server-side from the session.
router.get("/my", authorize("MANAGER"), getMyCommissions);
router.get("/my/summary", authorize("MANAGER"), getMyCommissionsSummary);
router.get(
  "/projects/:projectId/my-split",
  authorize("MANAGER"),
  validate(projectIdParamSchema),
  getMySplitForProject
);

// Everything else is a partner-payout / financial admin concern — ADMIN only, same as invoices.
router.use(authorize("ADMIN"));

router.get("/summary", getCommissionsOwedSummary);
router.get("/", getCommissions);
router.post("/:id/mark-paid", sensitiveWriteRateLimit, validate(commissionIdParamSchema), markCommissionPaid);

router.get("/projects/:projectId/splits", validate(projectIdParamSchema), getProjectCommissionSplits);
router.put("/projects/:projectId/splits", sensitiveWriteRateLimit, validate(setCommissionSplitsSchema), setProjectCommissionSplits);
router.post(
  "/projects/:projectId/reset-to-auto",
  sensitiveWriteRateLimit,
  validate(projectIdParamSchema),
  resetProjectCommissionSplitToAuto
);
router.post(
  "/projects/:projectId/commission-mode/per-task",
  sensitiveWriteRateLimit,
  validate(projectIdParamSchema),
  setProjectCommissionModeToPerTask
);
router.get("/projects/:projectId/history", validate(projectIdParamSchema), getProjectCommissionSplitHistory);
router.put(
  "/projects/:projectId/payout-budget",
  sensitiveWriteRateLimit,
  validate(setProjectPayoutBudgetSchema),
  setProjectPayoutBudget
);

export default router;
