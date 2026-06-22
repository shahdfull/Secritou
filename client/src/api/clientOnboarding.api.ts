import apiClient from "./axios";

export interface ClientOnboarding {
  id: string;
  projectId: string;
  clientId: string;
  assignedUserId?: string;
  createdAt: string;
  updatedAt: string;
  project: any;
  client: any;
  assignedUser?: any;
  steps: OnboardingStep[];
}

export interface OnboardingStep {
  id: string;
  onboardingId: string;
  stepType: string;
  title: string;
  description?: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";
  orderIndex: number;
  deadline?: string;
  completedAt?: string;
  contract?: any;
  payment?: any;
  questionnaire?: any;
  specifications?: any;
  kickoff?: any;
  production?: any;
  delivery?: any;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const clientOnboardingApi = {
  createOnboarding: async (data: { projectId: string; assignedUserId?: string }) => {
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

  updateOnboarding: async (id: string, data: any) => {
    const response = await apiClient.put<{ data: ClientOnboarding }>(
      `/client-onboardings/${id}`,
      data
    );
    return response.data.data;
  },

  deleteOnboarding: async (id: string) => {
    await apiClient.delete(`/client-onboardings/${id}`);
  },

  updateStep: async (stepId: string, data: any) => {
    const response = await apiClient.put<{ data: OnboardingStep }>(
      `/client-onboardings/steps/${stepId}`,
      data
    );
    return response.data.data;
  },

  createContract: async (stepId: string, data: any) => {
    const response = await apiClient.post<{ data: any }>(
      `/client-onboardings/steps/${stepId}/contract`,
      data
    );
    return response.data.data;
  },

  updateContract: async (contractId: string, data: any) => {
    const response = await apiClient.put<{ data: any }>(
      `/client-onboardings/contracts/${contractId}`,
      data
    );
    return response.data.data;
  },

  createPayment: async (stepId: string, data: any) => {
    const response = await apiClient.post<{ data: any }>(
      `/client-onboardings/steps/${stepId}/payment`,
      data
    );
    return response.data.data;
  },

  updatePayment: async (paymentId: string, data: any) => {
    const response = await apiClient.put<{ data: any }>(
      `/client-onboardings/payments/${paymentId}`,
      data
    );
    return response.data.data;
  },

  createQuestionnaire: async (stepId: string, data: any) => {
    const response = await apiClient.post<{ data: any }>(
      `/client-onboardings/steps/${stepId}/questionnaire`,
      data
    );
    return response.data.data;
  },

  updateQuestionnaire: async (questionnaireId: string, data: any) => {
    const response = await apiClient.put<{ data: any }>(
      `/client-onboardings/questionnaires/${questionnaireId}`,
      data
    );
    return response.data.data;
  },

  createSpecifications: async (stepId: string, data: any) => {
    const response = await apiClient.post<{ data: any }>(
      `/client-onboardings/steps/${stepId}/specifications`,
      data
    );
    return response.data.data;
  },

  updateSpecifications: async (specificationsId: string, data: any) => {
    const response = await apiClient.put<{ data: any }>(
      `/client-onboardings/specifications/${specificationsId}`,
      data
    );
    return response.data.data;
  },

  createKickoff: async (stepId: string, data: any) => {
    const response = await apiClient.post<{ data: any }>(
      `/client-onboardings/steps/${stepId}/kickoff`,
      data
    );
    return response.data.data;
  },

  updateKickoff: async (kickoffId: string, data: any) => {
    const response = await apiClient.put<{ data: any }>(
      `/client-onboardings/kickoffs/${kickoffId}`,
      data
    );
    return response.data.data;
  },

  createProduction: async (stepId: string, data: any) => {
    const response = await apiClient.post<{ data: any }>(
      `/client-onboardings/steps/${stepId}/production`,
      data
    );
    return response.data.data;
  },

  updateProduction: async (productionId: string, data: any) => {
    const response = await apiClient.put<{ data: any }>(
      `/client-onboardings/productions/${productionId}`,
      data
    );
    return response.data.data;
  },

  createDelivery: async (stepId: string, data: any) => {
    const response = await apiClient.post<{ data: any }>(
      `/client-onboardings/steps/${stepId}/delivery`,
      data
    );
    return response.data.data;
  },

  updateDelivery: async (deliveryId: string, data: any) => {
    const response = await apiClient.put<{ data: any }>(
      `/client-onboardings/deliveries/${deliveryId}`,
      data
    );
    return response.data.data;
  },
};
