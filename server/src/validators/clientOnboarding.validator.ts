import { z } from "zod";

export const createOnboardingValidator = z.object({
  body: z.object({
    projectId: z.string().uuid(),
    assignedUserId: z.string().uuid().optional(),
  }),
});

export const updateOnboardingValidator = z.object({
  body: z.object({
    assignedUserId: z.string().uuid().optional(),
  }),
});

export const updateStepValidator = z.object({
  body: z.object({
    status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "REJECTED"]).optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    deadline: z.string().optional(),
  }),
});

export const updateContractValidator = z.object({
  body: z.object({
    contractUrl: z.string().optional(),
    status: z.enum(["PENDING", "SIGNED"]).optional(),
  }),
});

export const updatePaymentValidator = z.object({
  body: z.object({
    amount: z.number().optional(),
    amountPaid: z.number().optional(),
    status: z.enum(["UNPAID", "PARTIAL", "PAID"]).optional(),
    deadline: z.string().optional(),
  }),
});

export const updateQuestionnaireValidator = z.object({
  body: z.object({
    serviceType: z.string().optional(),
    data: z.any().optional(),
    isDraft: z.boolean().optional(),
  }),
});

export const updateSpecificationsValidator = z.object({
  body: z.object({
    requirements: z.string().optional(),
    objectives: z.string().optional(),
    features: z.string().optional(),
    deliverables: z.string().optional(),
    timeline: z.string().optional(),
    approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
    feedback: z.string().optional(),
  }),
});

export const updateKickoffValidator = z.object({
  body: z.object({
    meetingDate: z.string().optional(),
    participants: z.string().optional(),
    meetingLink: z.string().optional(),
  }),
});

export const updateProductionValidator = z.object({
  body: z.object({
    analysis: z.number().optional(),
    design: z.number().optional(),
    development: z.number().optional(),
    testing: z.number().optional(),
    deployment: z.number().optional(),
  }),
});

export const updateDeliveryValidator = z.object({
  body: z.object({
    deliverables: z.string().optional(),
    documentation: z.string().optional(),
    accessDetails: z.string().optional(),
    userGuides: z.string().optional(),
  }),
});
