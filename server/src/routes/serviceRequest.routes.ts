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
  updateServiceRequestSchema,
  adminUpdateServiceRequestSchema,
  addCommentSchema,
} from "../validators/serviceRequest.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
const router = Router();

router.use(authenticate);

// ── Client routes ─────────────────────────────────────────────────────────────
router.get("/my", authorize("CLIENT"), getClientServiceRequests);
router.post(
  "/my",
  authorize("CLIENT"),
  validate(createServiceRequestSchema),
  createClientServiceRequest
);

// ── Admin / Manager routes ────────────────────────────────────────────────────
router.get(
  "/admin",
  authorize("ADMIN", "MANAGER"),
  adminGetServiceRequests
);
router.get(
  "/admin/:id",
  authorize("ADMIN", "MANAGER"),
  adminGetServiceRequestById
);
router.patch(
  "/admin/:id",
  authorize("ADMIN", "MANAGER"),
  validate(adminUpdateServiceRequestSchema),
  adminUpdateServiceRequest
);
router.delete(
  "/admin/:id",
  authorize("ADMIN"),
  adminDeleteServiceRequest
);

// Comments (admin + manager only)
router.post(
  "/admin/:id/comments",
  authorize("ADMIN", "MANAGER"),
  validate(addCommentSchema),
  addComment
);
router.delete(
  "/admin/:id/comments/:commentId",
  authorize("ADMIN", "MANAGER"),
  deleteComment
);


export default router;
