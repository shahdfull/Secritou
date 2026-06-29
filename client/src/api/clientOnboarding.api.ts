import apiClient from "./axios";
import type {
  ClientOnboarding,
  OnboardingStep,
  Contract,
  Payment,
  Questionnaire,
  Specifications,
  KickoffMeeting,
  ProductionProgress,
  Delivery,
  CreateOnboardingPayload,
  UpdateOnboardingPayload,
  UpdateStepPayload,
  ContractPayload,
  PaymentPayload,
  QuestionnairePayload,
  SpecificationsPayload,
  KickoffPayload,
  ProductionPayload,
  DeliveryPayload,
} from "@secritou/shared";

// Re-export the shared response types so existing local imports keep working.
export type {
  ClientOnboarding,
  OnboardingStep,
  Contract,
  Payment,
  Questionnaire,
  Specifications,
  KickoffMeeting,
  ProductionProgress,
  Delivery,
  CreateOnboardingPayload,
  UpdateOnboardingPayload,
  UpdateStepPayload,
  ContractPayload,
  PaymentPayload,
  QuestionnairePayload,
  SpecificationsPayload,
  KickoffPayload,
  ProductionPayload,
  DeliveryPayload,
};

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const clientOnboardingApi = {
  createOnboarding: async (data: CreateOnboardingPayload) => {
    const response = await apiClient.post<{ data: ClientOnboarding }>(
      "/client-onboardings",
      data
    );
    return response.data.data;
  },

  getOnboardings: async (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }) => {
    const response = await apiClient.get<PaginatedResponse<ClientOnboarding>>(
      "/client-onboardings",
      { params }
    );
    return response.data;
  },

  getOnboardingById: async (id: string) => {
    const response = await apiClient.get<{ data: ClientOnboarding }>(
      `/client-onboardings/${id}`
    );
    return response.data.data;
  },

  getOnboardingByProjectId: async (projectId: string) => {
    const response = await apiClient.get<{ data: ClientOnboarding }>(
      `/client-onboardings/project/${projectId}`
    );
    return response.data.data;
  },

  getOnboardingByClientId: async (clientId: string) => {
    const response = await apiClient.get<PaginatedResponse<ClientOnboarding>>(
      "/client-onboardings",
      { params: { clientId, pageSize: 1 } }
    );
    return response.data.data[0] ?? null;
  },

  updateOnboarding: async (id: string, data: UpdateOnboardingPayload) => {
    const response = await apiClient.put<{ data: ClientOnboarding }>(
      `/client-onboardings/${id}`,
      data
    );
    return response.data.data;
  },

  deleteOnboarding: async (id: string) => {
    await apiClient.delete(`/client-onboardings/${id}`);
  },

  updateStep: async (stepId: string, data: UpdateStepPayload) => {
    const response = await apiClient.put<{ data: OnboardingStep }>(
      `/client-onboardings/steps/${stepId}`,
      data
    );
    return response.data.data;
  },

  createContract: async (stepId: string, data: ContractPayload) => {
    const response = await apiClient.post<{ data: Contract }>(
      `/client-onboardings/steps/${stepId}/contract`,
      data
    );
    return response.data.data;
  },

  updateContract: async (contractId: string, data: ContractPayload) => {
    const response = await apiClient.put<{ data: Contract }>(
      `/client-onboardings/contracts/${contractId}`,
      data
    );
    return response.data.data;
  },

  createPayment: async (stepId: string, data: PaymentPayload) => {
    const response = await apiClient.post<{ data: Payment }>(
      `/client-onboardings/steps/${stepId}/payment`,
      data
    );
    return response.data.data;
  },

  updatePayment: async (paymentId: string, data: PaymentPayload) => {
    const response = await apiClient.put<{ data: Payment }>(
      `/client-onboardings/payments/${paymentId}`,
      data
    );
    return response.data.data;
  },

  createQuestionnaire: async (stepId: string, data: QuestionnairePayload) => {
    const response = await apiClient.post<{ data: Questionnaire }>(
      `/client-onboardings/steps/${stepId}/questionnaire`,
      data
    );
    return response.data.data;
  },

  updateQuestionnaire: async (questionnaireId: string, data: QuestionnairePayload) => {
    const response = await apiClient.put<{ data: Questionnaire }>(
      `/client-onboardings/questionnaires/${questionnaireId}`,
      data
    );
    return response.data.data;
  },

  createSpecifications: async (stepId: string, data: SpecificationsPayload) => {
    const response = await apiClient.post<{ data: Specifications }>(
      `/client-onboardings/steps/${stepId}/specifications`,
      data
    );
    return response.data.data;
  },

  updateSpecifications: async (specificationsId: string, data: SpecificationsPayload) => {
    const response = await apiClient.put<{ data: Specifications }>(
      `/client-onboardings/specifications/${specificationsId}`,
      data
    );
    return response.data.data;
  },

  createKickoff: async (stepId: string, data: KickoffPayload) => {
    const response = await apiClient.post<{ data: KickoffMeeting }>(
      `/client-onboardings/steps/${stepId}/kickoff`,
      data
    );
    return response.data.data;
  },

  updateKickoff: async (kickoffId: string, data: KickoffPayload) => {
    const response = await apiClient.put<{ data: KickoffMeeting }>(
      `/client-onboardings/kickoffs/${kickoffId}`,
      data
    );
    return response.data.data;
  },

  createProduction: async (stepId: string, data: ProductionPayload) => {
    const response = await apiClient.post<{ data: ProductionProgress }>(
      `/client-onboardings/steps/${stepId}/production`,
      data
    );
    return response.data.data;
  },

  updateProduction: async (productionId: string, data: ProductionPayload) => {
    const response = await apiClient.put<{ data: ProductionProgress }>(
      `/client-onboardings/productions/${productionId}`,
      data
    );
    return response.data.data;
  },

  createDelivery: async (stepId: string, data: DeliveryPayload) => {
    const response = await apiClient.post<{ data: Delivery }>(
      `/client-onboardings/steps/${stepId}/delivery`,
      data
    );
    return response.data.data;
  },

  updateDelivery: async (deliveryId: string, data: DeliveryPayload) => {
    const response = await apiClient.put<{ data: Delivery }>(
      `/client-onboardings/deliveries/${deliveryId}`,
      data
    );
    return response.data.data;
  },
};
