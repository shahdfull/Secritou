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
} from "../controllers/serviceRequest.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createServiceRequestSchema,
  adminUpdateServiceRequestSchema,
  addCommentSchema,
} from "../validators/serviceRequest.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission, requireActivatedPortal } from "../middlewares/rbac.middleware.js";
const router = Router();

router.use(authenticate);

// ── Client routes ─────────────────────────────────────────────────────────────
router.get("/my", authorize("CLIENT"), requireActivatedPortal, getClientServiceRequests);
router.post(
  "/my",
  authorize("CLIENT"),
  requireActivatedPortal,
  validate(createServiceRequestSchema),
  createClientServiceRequest
);

// ── Admin / Manager routes ────────────────────────────────────────────────────
router.get(
  "/admin",
  authorize("ADMIN", "MANAGER"),
  requirePermission("service-requests", "read"),
  adminGetServiceRequests
);
router.get(
  "/admin/:id",
  authorize("ADMIN", "MANAGER"),
  requirePermission("service-requests", "read"),
  adminGetServiceRequestById
);
router.patch(
  "/admin/:id",
  authorize("ADMIN", "MANAGER"),
  requirePermission("service-requests", "update"),
  validate(adminUpdateServiceRequestSchema),
  adminUpdateServiceRequest
);
router.delete(
  "/admin/:id",
  authorize("ADMIN"),
  requirePermission("service-requests", "delete"),
  adminDeleteServiceRequest
);

// Comments (admin + manager only)
router.post(
  "/admin/:id/comments",
  authorize("ADMIN", "MANAGER"),
  requirePermission("service-requests", "update"),
  validate(addCommentSchema),
  addComment
);
router.delete(
  "/admin/:id/comments/:commentId",
  authorize("ADMIN", "MANAGER"),
  requirePermission("service-requests", "update"),
  deleteComment
);


export default router;
