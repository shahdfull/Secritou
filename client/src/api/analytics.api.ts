import apiClient from "./axios";
import type { ApiResponse } from "../types/auth";
import type { AnalyticsSummary } from "../types/analyticsData";
import type { ExecutiveMetrics } from "../types/executiveMetrics";

export const analyticsApi = {
  getSummary: async (from?: Date, to?: Date): Promise<AnalyticsSummary> => {
    const params: any = {};
    if (from) params.from = from.toISOString();
    if (to) params.to = to.toISOString();
    const response = await apiClient.get<ApiResponse<AnalyticsSummary>>("/analytics/summary", { params });
    return response.data.data;
  },

  getExecutiveMetrics: async (serviceId?: string): Promise<ExecutiveMetrics> => {
    const response = await apiClient.get<ApiResponse<ExecutiveMetrics>>("/analytics/executive", {
      params: serviceId ? { serviceId } : undefined,
    });
    return response.data.data;
  },
};
