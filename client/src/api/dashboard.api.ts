import apiClient from "./axios";

export type DashboardSummary = {
  totalLeads: number;
  activeClients: number;
  ongoingProjects: number;
  completedTasks: number;
};

export const dashboardApi = {
  getSummary: async (): Promise<DashboardSummary> => {
    const response = await apiClient.get<{ data: DashboardSummary }>("/dashboard/summary");
    return response.data.data;
  },
};
