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
} from "../controllers/approval.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { requireCompanyTenant } from "../middlewares/tenant.middleware.js";

const router = express.Router();

// Apply base middleware to all approval routes
router.use(authenticate, requireCompanyTenant());

// Protected routes
router.get("/", authorize("ADMIN", "MANAGER"), getApprovals);
router.get("/:id", authorize("ADMIN", "MANAGER"), getApprovalById);
router.post("/", authorize("ADMIN", "MANAGER"), createApproval);
router.put("/:id", authorize("ADMIN", "MANAGER"), updateApproval);
router.delete("/:id", authorize("ADMIN"), deleteApproval);
router.post("/:id/approve", approveApproval);
router.post("/:id/reject", rejectApproval);
router.post("/:id/comment", commentApproval);

// Attachments
router.post(
  "/:id/attachments",
  authorize("ADMIN", "MANAGER"),
  addApprovalAttachment
);
router.delete(
  "/:id/attachments/:attachmentId",
  authorize("ADMIN"),
  deleteApprovalAttachment
);

export default router;
