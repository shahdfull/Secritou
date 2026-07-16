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
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "create"),
  createOnboarding
);
router.put(
  "/:id",
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "update"),
  updateOnboarding
);
router.delete(
  "/:id",
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
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requirePermission("client-onboarding", "update"),
  updateStep
);

// Contract routes
router.post(
  "/steps/:stepId/contract",
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "create"),
  createContract
);
router.put(
  "/contracts/:contractId",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requirePermission("client-onboarding", "update"),
  updateContract
);

// Payment routes
router.post(
  "/steps/:stepId/payment",
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "create"),
  createPayment
);
router.put(
  "/payments/:paymentId",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requirePermission("client-onboarding", "update"),
  updatePayment
);

// Questionnaire routes
router.post(
  "/steps/:stepId/questionnaire",
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "create"),
  createQuestionnaire
);
router.put(
  "/questionnaires/:questionnaireId",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requireActivatedPortal,
  requirePermission("client-onboarding", "update"),
  updateQuestionnaire
);

// Specifications routes
router.post(
  "/steps/:stepId/specifications",
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "create"),
  createSpecifications
);
router.put(
  "/specifications/:specificationsId",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requireActivatedPortal,
  requirePermission("client-onboarding", "update"),
  updateSpecifications
);

// Kickoff routes
router.post(
  "/steps/:stepId/kickoff",
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "create"),
  createKickoff
);
router.put(
  "/kickoffs/:kickoffId",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requireActivatedPortal,
  requirePermission("client-onboarding", "update"),
  updateKickoff
);

// Production routes
router.post(
  "/steps/:stepId/production",
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "create"),
  createProduction
);
router.put(
  "/productions/:productionId",
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "update"),
  updateProduction
);

// Delivery routes
router.post(
  "/steps/:stepId/delivery",
  authorize("ADMIN", "MANAGER"),
  requirePermission("client-onboarding", "create"),
  createDelivery
);
router.put(
  "/deliveries/:deliveryId",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requireActivatedPortal,
  requirePermission("client-onboarding", "update"),
  updateDelivery
);

export default router;
