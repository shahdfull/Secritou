import apiClient from "./axios";
import type { ApiResponse } from "../types/auth";
import type { AnalyticsSummary } from "../types/analyticsData";

export const analyticsApi = {
  getSummary: async (): Promise<AnalyticsSummary> => {
    const response = await apiClient.get<ApiResponse<AnalyticsSummary>>("/analytics/summary");
    return response.data.data;
  },
};
