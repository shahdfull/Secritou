import { z } from "zod";

// Enums (mirror Prisma) ──────────────────────────────────────────────────────
export const ONBOARDING_STEP_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "REJECTED"] as const;
export type OnboardingStepStatus = (typeof ONBOARDING_STEP_STATUSES)[number];

export const CONTRACT_STATUSES = ["PENDING", "SIGNED"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const ONBOARDING_PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID"] as const;
export type OnboardingPaymentStatus = (typeof ONBOARDING_PAYMENT_STATUSES)[number];

export const SPEC_APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type SpecApprovalStatus = (typeof SPEC_APPROVAL_STATUSES)[number];

// Request payload schemas (mirror server validators' bodies) ──────────────────
export const createOnboardingPayloadSchema = z.object({
  projectId: z.string().uuid(),
  assignedUserId: z.string().uuid().optional(),
});

export const updateOnboardingPayloadSchema = z.object({
  assignedUserId: z.string().uuid().optional(),
});

export const updateStepPayloadSchema = z.object({
  status: z.enum(ONBOARDING_STEP_STATUSES).optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  deadline: z.string().optional(),
  completedAt: z.string().optional().nullable(),
});

export const contractPayloadSchema = z.object({
  contractUrl: z.string().optional(),
  status: z.enum(CONTRACT_STATUSES).optional(),
});

export const paymentPayloadSchema = z.object({
  amount: z.number().nonnegative().optional(),
  amountPaid: z.number().nonnegative().optional(),
  status: z.enum(ONBOARDING_PAYMENT_STATUSES).optional(),
  deadline: z.string().optional(),
});

export const questionnairePayloadSchema = z.object({
  serviceType: z.string().optional(),
  data: z.unknown().optional(),
  isDraft: z.boolean().optional(),
});

export const specificationsPayloadSchema = z.object({
  requirements: z.string().optional(),
  objectives: z.string().optional(),
  features: z.string().optional(),
  deliverables: z.string().optional(),
  timeline: z.string().optional(),
  approvalStatus: z.enum(SPEC_APPROVAL_STATUSES).optional(),
  feedback: z.string().optional(),
});

export const kickoffPayloadSchema = z.object({
  meetingDate: z.string().optional(),
  participants: z.string().optional(),
  meetingLink: z.string().optional(),
});

export const productionPayloadSchema = z.object({
  analysis: z.number().int().min(0).max(100).optional(),
  design: z.number().int().min(0).max(100).optional(),
  development: z.number().int().min(0).max(100).optional(),
  testing: z.number().int().min(0).max(100).optional(),
  deployment: z.number().int().min(0).max(100).optional(),
});

export const deliveryPayloadSchema = z.object({
  deliverables: z.string().optional(),
  documentation: z.string().optional(),
  accessDetails: z.string().optional(),
  userGuides: z.string().optional(),
});

// Inferred payload types ──────────────────────────────────────────────────────
export type CreateOnboardingPayload = z.input<typeof createOnboardingPayloadSchema>;
export type UpdateOnboardingPayload = z.input<typeof updateOnboardingPayloadSchema>;
export type UpdateStepPayload = z.input<typeof updateStepPayloadSchema>;
export type ContractPayload = z.input<typeof contractPayloadSchema>;
export type PaymentPayload = z.input<typeof paymentPayloadSchema>;
export type QuestionnairePayload = z.input<typeof questionnairePayloadSchema>;
export type SpecificationsPayload = z.input<typeof specificationsPayloadSchema>;
export type KickoffPayload = z.input<typeof kickoffPayloadSchema>;
export type ProductionPayload = z.input<typeof productionPayloadSchema>;
export type DeliveryPayload = z.input<typeof deliveryPayloadSchema>;

// Response shapes (returned by the API) ───────────────────────────────────────
export interface Contract {
  id: string;
  onboardingStepId: string;
  contractUrl: string | null;
  status: ContractStatus;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  onboardingStepId: string | null;
  amount: number | null;
  amountPaid: number | null;
  status: OnboardingPaymentStatus;
  deadline: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Questionnaire {
  id: string;
  onboardingStepId: string;
  serviceType: string;
  data: unknown;
  isDraft: boolean;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Specifications {
  id: string;
  onboardingStepId: string;
  requirements: string | null;
  objectives: string | null;
  features: string | null;
  deliverables: string | null;
  timeline: string | null;
  approvalStatus: SpecApprovalStatus;
  feedback: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KickoffMeeting {
  id: string;
  onboardingStepId: string;
  meetingDate: string | null;
  participants: string | null;
  meetingLink: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionProgress {
  id: string;
  onboardingStepId: string;
  analysis: number;
  design: number;
  development: number;
  testing: number;
  deployment: number;
  createdAt: string;
  updatedAt: string;
}

export interface Delivery {
  id: string;
  onboardingStepId: string;
  deliverables: string | null;
  documentation: string | null;
  accessDetails: string | null;
  userGuides: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingStep {
  id: string;
  onboardingId: string;
  stepType: string;
  title: string;
  description?: string | null;
  status: OnboardingStepStatus;
  orderIndex: number;
  deadline?: string | null;
  completedAt?: string | null;
  contract?: Contract | null;
  payment?: Payment | null;
  questionnaire?: Questionnaire | null;
  specifications?: Specifications | null;
  kickoff?: KickoffMeeting | null;
  production?: ProductionProgress | null;
  delivery?: Delivery | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientOnboardingClientRef {
  id: string;
  name: string;
  email?: string | null;
}

export interface ClientOnboardingProjectRef {
  id: string;
  name: string;
}

export interface ClientOnboardingUserRef {
  id: string;
  name: string;
  email?: string | null;
}

export interface ClientOnboarding {
  id: string;
  projectId: string;
  clientId: string;
  assignedUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  project: ClientOnboardingProjectRef | null;
  client: ClientOnboardingClientRef;
  assignedUser?: ClientOnboardingUserRef | null;
  steps: OnboardingStep[];
}
