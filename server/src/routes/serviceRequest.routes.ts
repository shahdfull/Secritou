import { Router } from "express";
import {
  getClientServiceRequests,
  createClientServiceRequest,
  adminGetServiceRequests,
  adminGetServiceRequestById,
  adminUpdateServiceRequest,
  adminDeleteServiceRequest,
  addComment,
  deleteComment,
  // legacy
  getCompanyServiceRequests,
  updateServiceRequest,
} from "../controllers/serviceRequest.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createServiceRequestSchema,
  updateServiceRequestSchema,
  adminUpdateServiceRequestSchema,
  addCommentSchema,
} from "../validators/serviceRequest.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { requireClientTenant, requireCompanyTenant } from "../middlewares/tenant.middleware.js";

const router = Router();

router.use(authenticate);

// ── Client routes ─────────────────────────────────────────────────────────────
router.get("/client", authorize("CLIENT"), requireClientTenant(), getClientServiceRequests);
router.post(
  "/client",
  authorize("CLIENT"),
  requireClientTenant(),
  validate(createServiceRequestSchema),
  createClientServiceRequest
);

// ── Admin / Manager routes ────────────────────────────────────────────────────
router.get(
  "/admin",
  authorize("ADMIN", "MANAGER"),
  requireCompanyTenant(),
  adminGetServiceRequests
);
router.get(
  "/admin/:id",
  authorize("ADMIN", "MANAGER"),
  requireCompanyTenant(),
  adminGetServiceRequestById
);
router.patch(
  "/admin/:id",
  authorize("ADMIN", "MANAGER"),
  requireCompanyTenant(),
  validate(adminUpdateServiceRequestSchema),
  adminUpdateServiceRequest
);
router.delete(
  "/admin/:id",
  authorize("ADMIN"),
  requireCompanyTenant(),
  adminDeleteServiceRequest
);

// Comments (admin + manager only)
router.post(
  "/admin/:id/comments",
  authorize("ADMIN", "MANAGER"),
  requireCompanyTenant(),
  validate(addCommentSchema),
  addComment
);
router.delete(
  "/admin/:id/comments/:commentId",
  authorize("ADMIN", "MANAGER"),
  requireCompanyTenant(),
  deleteComment
);

// ── Legacy routes (backward compat) ──────────────────────────────────────────
router.get("/company", authorize("ADMIN"), requireCompanyTenant(), getCompanyServiceRequests);
router.put(
  "/:id",
  authorize("ADMIN"),
  requireCompanyTenant(),
  validate(updateServiceRequestSchema),
  updateServiceRequest
);

export default router;
