import express from "express";
import {
  getOnboardings,
  getOnboardingById,
  getOnboardingByProjectId,
  createOnboarding,
  updateOnboarding,
  deleteOnboarding,
  updateStep,
  createContract,
  updateContract,
  createPayment,
  updatePayment,
  createQuestionnaire,
  updateQuestionnaire,
  createSpecifications,
  updateSpecifications,
  createKickoff,
  updateKickoff,
  createProduction,
  updateProduction,
  createDelivery,
  updateDelivery,
} from "../controllers/clientOnboarding.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requireActivatedPortal, requirePermission } from "../middlewares/rbac.middleware.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";
const router = express.Router();

// Apply base middleware to all onboarding routes
router.use(authenticate);

router.get(
  "/",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requirePermission("client-onboarding", "read"),
  getOnboardings
);
router.get(
  "/:id",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requirePermission("client-onboarding", "read"),
  getOnboardingById
);
router.get(
  "/project/:projectId",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requirePermission("client-onboarding", "read"),
  getOnboardingByProjectId
);
router.post(
  "/",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "create"),
  createOnboarding
);
router.put(
  "/:id",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "update"),
  updateOnboarding
);
router.delete(
  "/:id",
  sensitiveWriteRateLimit,
  authorize("ADMIN"),
  deleteOnboarding
);

// Step / Contract / Payment routes intentionally omit requireActivatedPortal:
// these are the pre-deposit flow steps (contract signature → deposit payment) that
// LEAD to portal activation. Gating them on activation would make it impossible
// for the client to complete the steps that trigger activation in the first place.
// Questionnaires, specs, kickoffs, and deliveries (post-activation) DO have the gate.
router.put(
  "/steps/:stepId",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requirePermission("client-onboarding", "update"),
  updateStep
);

// Contract routes
router.post(
  "/steps/:stepId/contract",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "create"),
  createContract
);
router.put(
  "/contracts/:contractId",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requirePermission("client-onboarding", "update"),
  updateContract
);

// Payment routes
router.post(
  "/steps/:stepId/payment",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "create"),
  createPayment
);
router.put(
  "/payments/:paymentId",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requirePermission("client-onboarding", "update"),
  updatePayment
);

// Questionnaire routes
router.post(
  "/steps/:stepId/questionnaire",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "create"),
  createQuestionnaire
);
router.put(
  "/questionnaires/:questionnaireId",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requireActivatedPortal,
  requirePermission("client-onboarding", "update"),
  updateQuestionnaire
);

// Specifications routes
router.post(
  "/steps/:stepId/specifications",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "create"),
  createSpecifications
);
router.put(
  "/specifications/:specificationsId",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requireActivatedPortal,
  requirePermission("client-onboarding", "update"),
  updateSpecifications
);

// Kickoff routes
router.post(
  "/steps/:stepId/kickoff",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "create"),
  createKickoff
);
router.put(
  "/kickoffs/:kickoffId",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requireActivatedPortal,
  requirePermission("client-onboarding", "update"),
  updateKickoff
);

// Production routes
router.post(
  "/steps/:stepId/production",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "create"),
  createProduction
);
router.put(
  "/productions/:productionId",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "update"),
  updateProduction
);

// Delivery routes
router.post(
  "/steps/:stepId/delivery",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "create"),
  createDelivery
);
router.put(
  "/deliveries/:deliveryId",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requireActivatedPortal,
  requirePermission("client-onboarding", "update"),
  updateDelivery
);

export default router;
