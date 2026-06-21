import apiClient from "./axios";

export type DashboardSummary = {
  totalLeads: number;
  activeClients: number;
  ongoingProjects: number;
  completedTasks: number;
};

export type FullDashboard = DashboardSummary & {
  pendingApprovalsCount: number;
  overdueInvoicesCount: number;
  hotLeadsCount: number;
  leads: Record<string, number>;
  clients: { total: number };
  projects: Record<string, number>;
  tasks: Record<string, number>;
  recentProjects: Array<{ id: string; name: string; status: string; createdAt: string; client: { id: string; name: string } }>;
  recentLeads: Array<{ id: string; name: string; email: string; status: string; createdAt: string }>;
  recentTasks: Array<{ id: string; title: string; status: string; updatedAt: string; project: { id: string; name: string } }>;
  invoices: { total: number; totalAmount: number; totalPaid: number };
};

export const dashboardApi = {
  getSummary: async (): Promise<DashboardSummary> => {
    const response = await apiClient.get<{ data: DashboardSummary }>("/dashboard/summary");
    return response.data.data;
  },

  getFull: async (): Promise<FullDashboard> => {
    const response = await apiClient.get<{ data: FullDashboard }>("/dashboard/full");
    return response.data.data;
  },
};
