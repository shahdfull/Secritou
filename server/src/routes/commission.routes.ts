import express from "express";
import {
  getProjectCommissionSplits,
  setProjectCommissionSplits,
  getCommissions,
  getCommissionsOwedSummary,
  getMyCommissions,
  getMyCommissionsSummary,
  getMySplitForProject,
  markCommissionPaid,
} from "../controllers/commission.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  projectIdParamSchema,
  commissionIdParamSchema,
  setCommissionSplitsSchema,
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

export default router;
