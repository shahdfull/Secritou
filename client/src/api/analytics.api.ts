import apiClient from "./axios";
import type { ApiResponse } from "../types/auth";
import type { AnalyticsSummary } from "../types/analyticsData";

export const analyticsApi = {
  getSummary: async (from?: Date, to?: Date): Promise<AnalyticsSummary> => {
    const params: any = {};
    if (from) params.from = from.toISOString();
    if (to) params.to = to.toISOString();
    const response = await apiClient.get<ApiResponse<AnalyticsSummary>>("/analytics/summary", { params });
    return response.data.data;
  },
};
