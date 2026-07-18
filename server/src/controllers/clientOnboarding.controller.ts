import type { RequestHandler } from "express";
import { clientOnboardingService } from "../services/clientOnboarding.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createOnboardingValidator,
  updateOnboardingValidator,
  deleteOnboardingValidator,
  getOnboardingByIdValidator,
  getOnboardingByProjectIdValidator,
  updateStepValidator,
  createContractValidator,
  updateContractValidator,
  createPaymentValidator,
  updatePaymentValidator,
  createQuestionnaireValidator,
  updateQuestionnaireValidator,
  createSpecificationsValidator,
  updateSpecificationsValidator,
  createKickoffValidator,
  updateKickoffValidator,
  createProductionValidator,
  updateProductionValidator,
  createDeliveryValidator,
  updateDeliveryValidator,
} from "../validators/clientOnboarding.validator.js";
import { buildServiceScope } from "../utils/serviceScope.js";

export const getOnboardings: RequestHandler = async (req, res, next) => {
  try {
    const userClientId = req.user?.clientId;
    const scope = req.user?.role === "MANAGER" ? await buildServiceScope(req) : undefined;
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await clientOnboardingService.getAllOnboardings({
      ...options,
    }, userClientId, scope?.userServiceId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getOnboardingById: RequestHandler[] = [
  validate(getOnboardingByIdValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const scope = req.user?.role === "MANAGER" ? await buildServiceScope(req) : undefined;
      const onboarding = await clientOnboardingService.getOnboardingById(
        req.params.id as string,
        userClientId,
        scope?.userServiceId
      );
      res.json({ data: onboarding });
    } catch (error) {
      next(error);
    }
  },
];

export const getOnboardingByProjectId: RequestHandler[] = [
  validate(getOnboardingByProjectIdValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const scope = req.user?.role === "MANAGER" ? await buildServiceScope(req) : undefined;
      const onboarding = await clientOnboardingService.getOnboardingByProjectId(
        req.params.projectId as string,
        userClientId,
        scope?.userServiceId
      );
      res.json({ data: onboarding });
    } catch (error) {
      next(error);
    }
  },
];

export const createOnboarding: RequestHandler[] = [
  validate(createOnboardingValidator),
  async (req, res, next) => {
    try {
      const onboarding = await clientOnboardingService.createOnboarding({
        ...req.body,
      });
      res.status(201).json({ data: onboarding });
    } catch (error) {
      next(error);
    }
  },
];

export const updateOnboarding: RequestHandler[] = [
  validate(updateOnboardingValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const onboarding = await clientOnboardingService.updateOnboarding(
        req.params.id as string,
        req.body,
        userClientId
      );
      res.json({ data: onboarding });
    } catch (error) {
      next(error);
    }
  },
];

export const deleteOnboarding: RequestHandler[] = [
  validate(deleteOnboardingValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      await clientOnboardingService.deleteOnboarding(
        req.params.id as string,
        userClientId
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
];

// Step operations
export const updateStep: RequestHandler[] = [
  validate(updateStepValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const step = await clientOnboardingService.updateStep(
        req.params.stepId as string,
        req.body,
        userClientId
      );
      res.json({ data: step });
    } catch (error) {
      next(error);
    }
  },
];

// Contract operations
export const createContract: RequestHandler[] = [
  validate(createContractValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const contract = await clientOnboardingService.createContract(
        req.params.stepId as string,
        req.body,
        userClientId
      );
      res.status(201).json({ data: contract });
    } catch (error) {
      next(error);
    }
  },
];

export const updateContract: RequestHandler[] = [
  validate(updateContractValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const contract = await clientOnboardingService.updateContract(
        req.params.contractId as string,
        req.body,
        userClientId
      );
      res.json({ data: contract });
    } catch (error) {
      next(error);
    }
  },
];

// Payment operations
export const createPayment: RequestHandler[] = [
  validate(createPaymentValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const payment = await clientOnboardingService.createPayment(
        req.params.stepId as string,
        req.body,
        userClientId
      );
      res.status(201).json({ data: payment });
    } catch (error) {
      next(error);
    }
  },
];

export const updatePayment: RequestHandler[] = [
  validate(updatePaymentValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const payment = await clientOnboardingService.updatePayment(
        req.params.paymentId as string,
        req.body,
        userClientId
      );
      res.json({ data: payment });
    } catch (error) {
      next(error);
    }
  },
];

// Questionnaire operations
export const createQuestionnaire: RequestHandler[] = [
  validate(createQuestionnaireValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const questionnaire = await clientOnboardingService.createQuestionnaire(
        req.params.stepId as string,
        req.body,
        userClientId
      );
      res.status(201).json({ data: questionnaire });
    } catch (error) {
      next(error);
    }
  },
];

export const updateQuestionnaire: RequestHandler[] = [
  validate(updateQuestionnaireValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const questionnaire = await clientOnboardingService.updateQuestionnaire(
        req.params.questionnaireId as string,
        req.body,
        userClientId
      );
      res.json({ data: questionnaire });
    } catch (error) {
      next(error);
    }
  },
];

// Specifications operations
export const createSpecifications: RequestHandler[] = [
  validate(createSpecificationsValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const specifications = await clientOnboardingService.createSpecifications(
        req.params.stepId as string,
        req.body,
        userClientId
      );
      res.status(201).json({ data: specifications });
    } catch (error) {
      next(error);
    }
  },
];

export const updateSpecifications: RequestHandler[] = [
  validate(updateSpecificationsValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const specifications = await clientOnboardingService.updateSpecifications(
        req.params.specificationsId as string,
        req.body,
        userClientId
      );
      res.json({ data: specifications });
    } catch (error) {
      next(error);
    }
  },
];

// Kickoff operations
export const createKickoff: RequestHandler[] = [
  validate(createKickoffValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const kickoff = await clientOnboardingService.createKickoff(
        req.params.stepId as string,
        req.body,
        userClientId
      );
      res.status(201).json({ data: kickoff });
    } catch (error) {
      next(error);
    }
  },
];

export const updateKickoff: RequestHandler[] = [
  validate(updateKickoffValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const kickoff = await clientOnboardingService.updateKickoff(
        req.params.kickoffId as string,
        req.body,
        userClientId
      );
      res.json({ data: kickoff });
    } catch (error) {
      next(error);
    }
  },
];

// Production operations
export const createProduction: RequestHandler[] = [
  validate(createProductionValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const production = await clientOnboardingService.createProduction(
        req.params.stepId as string,
        req.body,
        userClientId
      );
      res.status(201).json({ data: production });
    } catch (error) {
      next(error);
    }
  },
];

export const updateProduction: RequestHandler[] = [
  validate(updateProductionValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const production = await clientOnboardingService.updateProduction(
        req.params.productionId as string,
        req.body,
        userClientId
      );
      res.json({ data: production });
    } catch (error) {
      next(error);
    }
  },
];

// Delivery operations
export const createDelivery: RequestHandler[] = [
  validate(createDeliveryValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const delivery = await clientOnboardingService.createDelivery(
        req.params.stepId as string,
        req.body,
        userClientId
      );
      res.status(201).json({ data: delivery });
    } catch (error) {
      next(error);
    }
  },
];

export const updateDelivery: RequestHandler[] = [
  validate(updateDeliveryValidator),
  async (req, res, next) => {
    try {
      const userClientId = req.user?.clientId;
      const delivery = await clientOnboardingService.updateDelivery(
        req.params.deliveryId as string,
        req.body,
        userClientId
      );
      res.json({ data: delivery });
    } catch (error) {
      next(error);
    }
  },
];
