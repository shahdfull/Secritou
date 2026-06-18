import apiClient from "./axios";

export interface ClientSuccess {
  id: string;
  clientId: string;
  client?: { name: string };
  companyId: string;
  score: number;
  objectives?: SuccessObjective[];
  metrics?: SuccessMetric[];
  recommendations?: SuccessRecommendation[];
  timeline?: SuccessTimeline[];
  createdAt: string;
  updatedAt: string;
}

export interface SuccessObjective {
  id: string;
  title: string;
  description?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  targetDate?: string;
  completedAt?: string;
  successId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SuccessMetric {
  id: string;
  name: string;
  initialValue: number;
  currentValue: number;
  unit?: string;
  successId: string;
  history?: MetricHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface MetricHistory {
  id: string;
  value: number;
  date: string;
  metricId: string;
  createdAt: string;
}

export interface SuccessRecommendation {
  id: string;
  title: string;
  description?: string;
  priority: number;
  status: string;
  successId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SuccessTimeline {
  id: string;
  title: string;
  description?: string;
  eventType: string;
  date: string;
  successId: string;
  createdAt: string;
}

export const clientSuccessApi = {
  getClientSuccess: async (clientId: string) => {
    const response = await apiClient.get<{ data: ClientSuccess }>(
      `/client-success/${clientId}`
    );
    return response.data.data;
  },

  updateScore: async (clientId: string, score: number) => {
    const response = await apiClient.put<{ data: ClientSuccess }>(
      `/client-success/${clientId}/score`,
      { score }
    );
    return response.data.data;
  },

  calculateScore: async (clientId: string) => {
    const response = await apiClient.post<{ data: { score: number } }>(
      `/client-success/${clientId}/calculate-score`
    );
    return response.data.data;
  },

  addObjective: async (
    clientId: string,
    data: {
      title: string;
      description?: string;
      targetValue?: number;
      currentValue?: number;
      unit?: string;
      targetDate?: string;
    }
  ) => {
    const response = await apiClient.post<{ data: SuccessObjective }>(
      `/client-success/${clientId}/objectives`,
      data
    );
    return response.data.data;
  },

  updateObjective: async (
    clientId: string,
    objectiveId: string,
    data: Partial<SuccessObjective>
  ) => {
    const response = await apiClient.put<{ data: SuccessObjective }>(
      `/client-success/${clientId}/objectives/${objectiveId}`,
      data
    );
    return response.data.data;
  },

  deleteObjective: async (clientId: string, objectiveId: string) => {
    const response = await apiClient.delete<{ data: { success: boolean } }>(
      `/client-success/${clientId}/objectives/${objectiveId}`
    );
    return response.data.data;
  },

  addMetric: async (
    clientId: string,
    data: { name: string; initialValue: number; currentValue: number; unit?: string }
  ) => {
    const response = await apiClient.post<{ data: SuccessMetric }>(
      `/client-success/${clientId}/metrics`,
      data
    );
    return response.data.data;
  },

  updateMetric: async (
    clientId: string,
    metricId: string,
    data: Partial<SuccessMetric>
  ) => {
    const response = await apiClient.put<{ data: SuccessMetric }>(
      `/client-success/${clientId}/metrics/${metricId}`,
      data
    );
    return response.data.data;
  },

  deleteMetric: async (clientId: string, metricId: string) => {
    const response = await apiClient.delete<{ data: { success: boolean } }>(
      `/client-success/${clientId}/metrics/${metricId}`
    );
    return response.data.data;
  },

  addRecommendation: async (
    clientId: string,
    data: {
      title: string;
      description?: string;
      priority?: number;
      status?: string;
    }
  ) => {
    const response = await apiClient.post<{ data: SuccessRecommendation }>(
      `/client-success/${clientId}/recommendations`,
      data
    );
    return response.data.data;
  },

  updateRecommendation: async (
    clientId: string,
    recommendationId: string,
    data: Partial<SuccessRecommendation>
  ) => {
    const response = await apiClient.put<{ data: SuccessRecommendation }>(
      `/client-success/${clientId}/recommendations/${recommendationId}`,
      data
    );
    return response.data.data;
  },

  deleteRecommendation: async (clientId: string, recommendationId: string) => {
    const response = await apiClient.delete<{ data: { success: boolean } }>(
      `/client-success/${clientId}/recommendations/${recommendationId}`
    );
    return response.data.data;
  },

  addTimeline: async (
    clientId: string,
    data: { title: string; description?: string; eventType: string; date?: string }
  ) => {
    const response = await apiClient.post<{ data: SuccessTimeline }>(
      `/client-success/${clientId}/timeline`,
      data
    );
    return response.data.data;
  },

  deleteTimeline: async (clientId: string, timelineId: string) => {
    const response = await apiClient.delete<{ data: { success: boolean } }>(
      `/client-success/${clientId}/timeline/${timelineId}`
    );
    return response.data.data;
  },
};
