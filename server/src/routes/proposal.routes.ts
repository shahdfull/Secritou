import express from "express";
import {
  getProposals,
  getProposalById,
  createProposal,
  updateProposal,
  deleteProposal,
  sendProposal,
  acceptProposal,
  rejectProposal,
  viewProposal,
  addProposalSection,
  updateProposalSection,
  deleteProposalSection,
} from "../controllers/proposal.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { requireCompanyTenant } from "../middlewares/tenant.middleware.js";

const router = express.Router();

// Apply base middleware to all proposal routes
router.use(authenticate, requireCompanyTenant());

// Protected routes
router.get("/", authorize("ADMIN", "MANAGER"), getProposals);
router.get("/:id", authorize("ADMIN", "MANAGER"), getProposalById);
router.post("/", authorize("ADMIN", "MANAGER"), createProposal);
router.put("/:id", authorize("ADMIN", "MANAGER"), updateProposal);
router.delete("/:id", authorize("ADMIN"), deleteProposal);
router.post("/:id/send", authorize("ADMIN", "MANAGER"), sendProposal);
router.post("/:id/accept", authorize("ADMIN", "MANAGER"), acceptProposal);
router.post("/:id/reject", authorize("ADMIN", "MANAGER"), rejectProposal);
router.post("/:id/view", viewProposal);

// Sections
router.post(
  "/:id/sections",
  authorize("ADMIN", "MANAGER"),
  addProposalSection
);
router.put(
  "/:id/sections/:sectionId",
  authorize("ADMIN", "MANAGER"),
  updateProposalSection
);
router.delete(
  "/:id/sections/:sectionId",
  authorize("ADMIN"),
  deleteProposalSection
);

export default router;
