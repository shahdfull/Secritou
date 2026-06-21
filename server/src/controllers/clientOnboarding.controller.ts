import type { RequestHandler } from "express";
import { clientOnboardingService } from "../services/clientOnboarding.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createOnboardingValidator,
  updateOnboardingValidator,
  updateStepValidator,
  updateContractValidator,
  updatePaymentValidator,
  updateQuestionnaireValidator,
  updateSpecificationsValidator,
  updateKickoffValidator,
  updateProductionValidator,
  updateDeliveryValidator,
} from "../validators/clientOnboarding.validator.js";

export const getOnboardings: RequestHandler = async (req, res, next) => {
  try {
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await clientOnboardingService.getAllOnboardings({
      ...options,
      companyId: req.user?.companyId ?? undefined,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getOnboardingById: RequestHandler = async (req, res, next) => {
  try {
    const onboarding = await clientOnboardingService.getOnboardingById(
      req.params.id as string,
      req.user!.companyId!
    );
    res.json({ data: onboarding });
  } catch (error) {
    next(error);
  }
};

export const getOnboardingByProjectId: RequestHandler = async (req, res, next) => {
  try {
    const onboarding = await clientOnboardingService.getOnboardingByProjectId(
      req.params.projectId as string,
      req.user!.companyId!
    );
    res.json({ data: onboarding });
  } catch (error) {
    next(error);
  }
};

export const createOnboarding: RequestHandler[] = [
  validate(createOnboardingValidator),
  async (req, res, next) => {
    try {
      const onboarding = await clientOnboardingService.createOnboarding({
        ...req.body,
        companyId: req.user?.companyId,
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
      const onboarding = await clientOnboardingService.updateOnboarding(
        req.params.id as string,
        req.user!.companyId!,
        req.body
      );
      res.json({ data: onboarding });
    } catch (error) {
      next(error);
    }
  },
];

export const deleteOnboarding: RequestHandler = async (req, res, next) => {
  try {
    await clientOnboardingService.deleteOnboarding(
      req.params.id as string,
      req.user!.companyId!
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Step operations
export const updateStep: RequestHandler[] = [
  validate(updateStepValidator),
  async (req, res, next) => {
    try {
      const step = await clientOnboardingService.updateStep(
        req.params.stepId as string,
        req.user!.companyId!,
        req.body
      );
      res.json({ data: step });
    } catch (error) {
      next(error);
    }
  },
];

// Contract operations
export const createContract: RequestHandler[] = [
  validate(updateContractValidator),
  async (req, res, next) => {
    try {
      const contract = await clientOnboardingService.createContract(
        req.params.stepId as string,
        req.user!.companyId!,
        req.body
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
      const contract = await clientOnboardingService.updateContract(
        req.params.contractId as string,
        req.user!.companyId!,
        req.body
      );
      res.json({ data: contract });
    } catch (error) {
      next(error);
    }
  },
];

// Payment operations
export const createPayment: RequestHandler[] = [
  validate(updatePaymentValidator),
  async (req, res, next) => {
    try {
      const payment = await clientOnboardingService.createPayment(
        req.params.stepId as string,
        req.user!.companyId!,
        req.body
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
      const payment = await clientOnboardingService.updatePayment(
        req.params.paymentId as string,
        req.user!.companyId!,
        req.body
      );
      res.json({ data: payment });
    } catch (error) {
      next(error);
    }
  },
];

// Questionnaire operations
export const createQuestionnaire: RequestHandler[] = [
  validate(updateQuestionnaireValidator),
  async (req, res, next) => {
    try {
      const questionnaire = await clientOnboardingService.createQuestionnaire(
        req.params.stepId as string,
        req.user!.companyId!,
        req.body
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
      const questionnaire = await clientOnboardingService.updateQuestionnaire(
        req.params.questionnaireId as string,
        req.user!.companyId!,
        req.body
      );
      res.json({ data: questionnaire });
    } catch (error) {
      next(error);
    }
  },
];

// Specifications operations
export const createSpecifications: RequestHandler[] = [
  validate(updateSpecificationsValidator),
  async (req, res, next) => {
    try {
      const specifications = await clientOnboardingService.createSpecifications(
        req.params.stepId as string,
        req.user!.companyId!,
        req.body
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
      const specifications = await clientOnboardingService.updateSpecifications(
        req.params.specificationsId as string,
        req.user!.companyId!,
        req.body
      );
      res.json({ data: specifications });
    } catch (error) {
      next(error);
    }
  },
];

// Kickoff operations
export const createKickoff: RequestHandler[] = [
  validate(updateKickoffValidator),
  async (req, res, next) => {
    try {
      const kickoff = await clientOnboardingService.createKickoff(
        req.params.stepId as string,
        req.user!.companyId!,
        req.body
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
      const kickoff = await clientOnboardingService.updateKickoff(
        req.params.kickoffId as string,
        req.user!.companyId!,
        req.body
      );
      res.json({ data: kickoff });
    } catch (error) {
      next(error);
    }
  },
];

// Production operations
export const createProduction: RequestHandler[] = [
  validate(updateProductionValidator),
  async (req, res, next) => {
    try {
      const production = await clientOnboardingService.createProduction(
        req.params.stepId as string,
        req.user!.companyId!,
        req.body
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
      const production = await clientOnboardingService.updateProduction(
        req.params.productionId as string,
        req.user!.companyId!,
        req.body
      );
      res.json({ data: production });
    } catch (error) {
      next(error);
    }
  },
];

// Delivery operations
export const createDelivery: RequestHandler[] = [
  validate(updateDeliveryValidator),
  async (req, res, next) => {
    try {
      const delivery = await clientOnboardingService.createDelivery(
        req.params.stepId as string,
        req.user!.companyId!,
        req.body
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
      const delivery = await clientOnboardingService.updateDelivery(
        req.params.deliveryId as string,
        req.user!.companyId!,
        req.body
      );
      res.json({ data: delivery });
    } catch (error) {
      next(error);
    }
  },
];
