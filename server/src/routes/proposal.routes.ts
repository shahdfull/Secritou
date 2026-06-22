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
  addProposalSection,
  updateProposalSection,
  deleteProposalSection,
  getMyProposals,
  respondToProposal,
} from "../controllers/proposal.controller.js";
import { createInvoiceFromProposal } from "../controllers/invoice.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { requireCompanyTenant } from "../middlewares/tenant.middleware.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createProposalSchema,
  updateProposalSchema,
  proposalIdParamSchema,
  rejectProposalSchema,
  respondToProposalSchema,
  addSectionSchema,
  updateSectionSchema,
  sectionParamSchema,
} from "../validators/proposal.validator.js";

const router = express.Router();

// CLIENT routes — before requireCompanyTenant (clients have no companyId)
router.get("/my", authenticate, authorize("CLIENT"), getMyProposals);
router.post("/:id/respond", authenticate, authorize("CLIENT"), sensitiveWriteRateLimit, validate(respondToProposalSchema), respondToProposal);

// Apply base middleware to all admin/manager routes
router.use(authenticate, requireCompanyTenant());

// Protected routes
router.get("/", authorize("ADMIN", "MANAGER"), getProposals);
router.get("/:id", authorize("ADMIN", "MANAGER"), validate(proposalIdParamSchema), getProposalById);
router.post("/", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), validate(createProposalSchema), createProposal);
router.put("/:id", authorize("ADMIN", "MANAGER"), validate(updateProposalSchema), updateProposal);
router.delete("/:id", sensitiveWriteRateLimit, authorize("ADMIN"), validate(proposalIdParamSchema), deleteProposal);
router.post("/:id/send", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), validate(proposalIdParamSchema), sendProposal);
router.post("/:id/accept", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), validate(proposalIdParamSchema), acceptProposal);
router.post("/:id/reject", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), validate(rejectProposalSchema), rejectProposal);
// Creating an invoice is a financial action — ADMIN only, like the invoice routes.
router.post("/:id/create-invoice", sensitiveWriteRateLimit, authorize("ADMIN"), validate(proposalIdParamSchema), createInvoiceFromProposal);

// Sections
router.post(
  "/:id/sections",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  validate(addSectionSchema),
  addProposalSection
);
router.put(
  "/:id/sections/:sectionId",
  authorize("ADMIN", "MANAGER"),
  validate(updateSectionSchema),
  updateProposalSection
);
router.delete(
  "/:id/sections/:sectionId",
  sensitiveWriteRateLimit,
  authorize("ADMIN"),
  validate(sectionParamSchema),
  deleteProposalSection
);

export default router;
