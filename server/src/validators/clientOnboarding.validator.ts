import { z } from "zod";

// Shared param helpers ─────────────────────────────────────────────────────
const uuidParam = z.string().uuid();

// Onboarding ───────────────────────────────────────────────────────────────
export const createOnboardingValidator = z.object({
  body: z
    .object({
      projectId: z.string().uuid(),
      assignedUserId: z.string().uuid().optional(),
    })
    .strict(),
});

export const updateOnboardingValidator = z.object({
  params: z.object({ id: uuidParam }).strict(),
  body: z
    .object({
      assignedUserId: z.string().uuid().optional(),
    })
    .strict(),
});

export const deleteOnboardingValidator = z.object({
  params: z.object({ id: uuidParam }).strict(),
});

export const getOnboardingByIdValidator = z.object({
  params: z.object({ id: uuidParam }).strict(),
});

export const getOnboardingByProjectIdValidator = z.object({
  params: z.object({ projectId: uuidParam }).strict(),
});

// Step ──────────────────────────────────────────────────────────────────────
export const updateStepValidator = z.object({
  params: z.object({ stepId: uuidParam }).strict(),
  body: z
    .object({
      status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "REJECTED"]).optional(),
      title: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      deadline: z.string().optional(),
      completedAt: z.string().optional().nullable(),
    })
    .strict(),
});

// Contract ───────────────────────────────────────────────────────────────────
const contractBody = z
  .object({
    contractUrl: z.string().optional(),
    status: z.enum(["PENDING", "SIGNED"]).optional(),
  })
  .strict();

export const createContractValidator = z.object({
  params: z.object({ stepId: uuidParam }).strict(),
  body: contractBody,
});

export const updateContractValidator = z.object({
  params: z.object({ contractId: uuidParam }).strict(),
  body: contractBody,
});

// Payment ────────────────────────────────────────────────────────────────────
const paymentBody = z
  .object({
    amount: z.number().nonnegative().optional(),
    amountPaid: z.number().nonnegative().optional(),
    status: z.enum(["UNPAID", "PARTIAL", "PAID"]).optional(),
    deadline: z.string().optional(),
  })
  .strict();

export const createPaymentValidator = z.object({
  params: z.object({ stepId: uuidParam }).strict(),
  body: paymentBody,
});

export const updatePaymentValidator = z.object({
  params: z.object({ paymentId: uuidParam }).strict(),
  body: paymentBody,
});

// Questionnaire ──────────────────────────────────────────────────────────────
// `data` maps to Prisma `Json?` — genuinely freeform, so z.unknown() (not z.any()).
const questionnaireBody = z
  .object({
    serviceType: z.string().optional(),
    data: z.unknown().optional(),
    isDraft: z.boolean().optional(),
  })
  .strict();

export const createQuestionnaireValidator = z.object({
  params: z.object({ stepId: uuidParam }).strict(),
  body: questionnaireBody,
});

export const updateQuestionnaireValidator = z.object({
  params: z.object({ questionnaireId: uuidParam }).strict(),
  body: questionnaireBody,
});

// Specifications ─────────────────────────────────────────────────────────────
const specificationsBody = z
  .object({
    requirements: z.string().optional(),
    objectives: z.string().optional(),
    features: z.string().optional(),
    deliverables: z.string().optional(),
    timeline: z.string().optional(),
    approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
    feedback: z.string().optional(),
  })
  .strict();

export const createSpecificationsValidator = z.object({
  params: z.object({ stepId: uuidParam }).strict(),
  body: specificationsBody,
});

export const updateSpecificationsValidator = z.object({
  params: z.object({ specificationsId: uuidParam }).strict(),
  body: specificationsBody,
});

// Kickoff ────────────────────────────────────────────────────────────────────
const kickoffBody = z
  .object({
    meetingDate: z.string().optional(),
    participants: z.string().optional(),
    meetingLink: z.string().optional(),
  })
  .strict();

export const createKickoffValidator = z.object({
  params: z.object({ stepId: uuidParam }).strict(),
  body: kickoffBody,
});

export const updateKickoffValidator = z.object({
  params: z.object({ kickoffId: uuidParam }).strict(),
  body: kickoffBody,
});

// Production ──────────────────────────────────────────────────────────────────
const productionBody = z
  .object({
    analysis: z.number().int().min(0).max(100).optional(),
    design: z.number().int().min(0).max(100).optional(),
    development: z.number().int().min(0).max(100).optional(),
    testing: z.number().int().min(0).max(100).optional(),
    deployment: z.number().int().min(0).max(100).optional(),
  })
  .strict();

export const createProductionValidator = z.object({
  params: z.object({ stepId: uuidParam }).strict(),
  body: productionBody,
});

export const updateProductionValidator = z.object({
  params: z.object({ productionId: uuidParam }).strict(),
  body: productionBody,
});

// Delivery ────────────────────────────────────────────────────────────────────
const deliveryBody = z
  .object({
    deliverables: z.string().optional(),
    documentation: z.string().optional(),
    accessDetails: z.string().optional(),
    userGuides: z.string().optional(),
  })
  .strict();

export const createDeliveryValidator = z.object({
  params: z.object({ stepId: uuidParam }).strict(),
  body: deliveryBody,
});

export const updateDeliveryValidator = z.object({
  params: z.object({ deliveryId: uuidParam }).strict(),
  body: deliveryBody,
});

// Inferred body types (consumed by the service layer) ────────────────────────
export type CreateOnboardingInput = z.infer<typeof createOnboardingValidator>["body"];
export type UpdateOnboardingInput = z.infer<typeof updateOnboardingValidator>["body"];
export type UpdateStepInput = z.infer<typeof updateStepValidator>["body"];
export type ContractInput = z.infer<typeof contractBody>;
export type PaymentInput = z.infer<typeof paymentBody>;
export type QuestionnaireInput = z.infer<typeof questionnaireBody>;
export type SpecificationsInput = z.infer<typeof specificationsBody>;
export type KickoffInput = z.infer<typeof kickoffBody>;
export type ProductionInput = z.infer<typeof productionBody>;
export type DeliveryInput = z.infer<typeof deliveryBody>;
