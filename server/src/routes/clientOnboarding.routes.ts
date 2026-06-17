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
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { rbacMiddleware } from "../middlewares/rbac.middleware.js";

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER", "CLIENT"]),
  getOnboardings
);
router.get(
  "/:id",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER", "CLIENT"]),
  getOnboardingById
);
router.get(
  "/project/:projectId",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER", "CLIENT"]),
  getOnboardingByProjectId
);
router.post(
  "/",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER"]),
  createOnboarding
);
router.put(
  "/:id",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER"]),
  updateOnboarding
);
router.delete(
  "/:id",
  authMiddleware,
  rbacMiddleware(["ADMIN"]),
  deleteOnboarding
);

// Step routes
router.put(
  "/steps/:stepId",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER", "CLIENT"]),
  updateStep
);

// Contract routes
router.post(
  "/steps/:stepId/contract",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER"]),
  createContract
);
router.put(
  "/contracts/:contractId",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER", "CLIENT"]),
  updateContract
);

// Payment routes
router.post(
  "/steps/:stepId/payment",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER"]),
  createPayment
);
router.put(
  "/payments/:paymentId",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER", "CLIENT"]),
  updatePayment
);

// Questionnaire routes
router.post(
  "/steps/:stepId/questionnaire",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER"]),
  createQuestionnaire
);
router.put(
  "/questionnaires/:questionnaireId",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER", "CLIENT"]),
  updateQuestionnaire
);

// Specifications routes
router.post(
  "/steps/:stepId/specifications",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER"]),
  createSpecifications
);
router.put(
  "/specifications/:specificationsId",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER", "CLIENT"]),
  updateSpecifications
);

// Kickoff routes
router.post(
  "/steps/:stepId/kickoff",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER"]),
  createKickoff
);
router.put(
  "/kickoffs/:kickoffId",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER", "CLIENT"]),
  updateKickoff
);

// Production routes
router.post(
  "/steps/:stepId/production",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER"]),
  createProduction
);
router.put(
  "/productions/:productionId",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER"]),
  updateProduction
);

// Delivery routes
router.post(
  "/steps/:stepId/delivery",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER"]),
  createDelivery
);
router.put(
  "/deliveries/:deliveryId",
  authMiddleware,
  rbacMiddleware(["ADMIN", "MANAGER", "CLIENT"]),
  updateDelivery
);

export default router;
