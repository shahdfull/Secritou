import express from "express";
import {
  getApprovals,
  getApprovalById,
  createApproval,
  updateApproval,
  deleteApproval,
  approveApproval,
  rejectApproval,
  commentApproval,
  addApprovalAttachment,
  deleteApprovalAttachment,
  getMyApprovals,
  respondToApproval,
} from "../controllers/approval.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission } from "../middlewares/rbac.middleware.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createApprovalSchema,
  updateApprovalSchema,
  approvalActionSchema,
  respondToApprovalSchema,
  addAttachmentSchema,
  approvalIdParamSchema,
  attachmentParamSchema,
} from "../validators/approval.validator.js";

const router = express.Router();

// CLIENT routes
router.get("/my", authenticate, authorize("CLIENT"), getMyApprovals);
router.post("/:id/respond", authenticate, authorize("CLIENT"), sensitiveWriteRateLimit, validate(respondToApprovalSchema), respondToApproval);

// Apply base middleware to all admin/manager routes
router.use(authenticate);

// Protected routes
router.get("/", authorize("ADMIN", "MANAGER"), requirePermission("approvals", "read"), getApprovals);
router.get("/:id", authorize("ADMIN", "MANAGER"), requirePermission("approvals", "read"), validate(approvalIdParamSchema), getApprovalById);
router.post("/", authorize("ADMIN", "MANAGER"), requirePermission("approvals", "create"), validate(createApprovalSchema), createApproval);
router.put("/:id", authorize("ADMIN", "MANAGER"), requirePermission("approvals", "update"), validate(updateApprovalSchema), updateApproval);
router.delete("/:id", authorize("ADMIN"), validate(approvalIdParamSchema), deleteApproval);
router.post("/:id/approve", authorize("ADMIN", "MANAGER"), requirePermission("approvals", "update"), validate(approvalActionSchema), approveApproval);
router.post("/:id/reject", authorize("ADMIN", "MANAGER"), requirePermission("approvals", "update"), validate(approvalActionSchema), rejectApproval);
router.post("/:id/comment", authorize("ADMIN", "MANAGER"), requirePermission("approvals", "update"), validate(approvalActionSchema), commentApproval);

// Attachments
router.post(
  "/:id/attachments",
  authorize("ADMIN", "MANAGER"),
  requirePermission("approvals", "update"),
  validate(addAttachmentSchema),
  addApprovalAttachment
);
router.delete(
  "/:id/attachments/:attachmentId",
  authorize("ADMIN"),
  validate(attachmentParamSchema),
  deleteApprovalAttachment
);

export default router;
