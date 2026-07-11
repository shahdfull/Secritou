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
import { authorize, requireActivatedPortal } from "../middlewares/rbac.middleware.js";
const router = express.Router();

// Apply base middleware to all onboarding routes
router.use(authenticate);

router.get(
  "/",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  getOnboardings
);
router.get(
  "/:id",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  getOnboardingById
);
router.get(
  "/project/:projectId",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  getOnboardingByProjectId
);
router.post(
  "/",
  authorize("ADMIN", "MANAGER"),
  createOnboarding
);
router.put(
  "/:id",
  authorize("ADMIN", "MANAGER"),
  updateOnboarding
);
router.delete(
  "/:id",
  authorize("ADMIN"),
  deleteOnboarding
);

// Step routes
router.put(
  "/steps/:stepId",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  updateStep
);

// Contract routes
router.post(
  "/steps/:stepId/contract",
  authorize("ADMIN", "MANAGER"),
  createContract
);
router.put(
  "/contracts/:contractId",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  updateContract
);

// Payment routes
router.post(
  "/steps/:stepId/payment",
  authorize("ADMIN", "MANAGER"),
  createPayment
);
router.put(
  "/payments/:paymentId",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  updatePayment
);

// Questionnaire routes
router.post(
  "/steps/:stepId/questionnaire",
  authorize("ADMIN", "MANAGER"),
  createQuestionnaire
);
router.put(
  "/questionnaires/:questionnaireId",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requireActivatedPortal,
  updateQuestionnaire
);

// Specifications routes
router.post(
  "/steps/:stepId/specifications",
  authorize("ADMIN", "MANAGER"),
  createSpecifications
);
router.put(
  "/specifications/:specificationsId",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requireActivatedPortal,
  updateSpecifications
);

// Kickoff routes
router.post(
  "/steps/:stepId/kickoff",
  authorize("ADMIN", "MANAGER"),
  createKickoff
);
router.put(
  "/kickoffs/:kickoffId",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requireActivatedPortal,
  updateKickoff
);

// Production routes
router.post(
  "/steps/:stepId/production",
  authorize("ADMIN", "MANAGER"),
  createProduction
);
router.put(
  "/productions/:productionId",
  authorize("ADMIN", "MANAGER"),
  updateProduction
);

// Delivery routes
router.post(
  "/steps/:stepId/delivery",
  authorize("ADMIN", "MANAGER"),
  createDelivery
);
router.put(
  "/deliveries/:deliveryId",
  authorize("ADMIN", "MANAGER", "CLIENT"),
  requireActivatedPortal,
  updateDelivery
);

export default router;
