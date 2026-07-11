import api from "./axios";

export type ClientHealthStatus = "champion" | "good" | "at-risk" | "lost";

export interface ClientProfitabilityItem {
  clientId: string;
  clientName: string;
  totalRevenue: number;
  pendingRevenue: number;
  totalCost: number;
  totalProjects: number;
  completedProjects: number;
  totalTaskMinutes: number;
  avgProjectDurationDays: number;
  lastProjectCompletedAt: string | null;
  healthStatus: ClientHealthStatus;
}

export const clientProfitabilityApi = {
  getProfitability: async (): Promise<ClientProfitabilityItem[]> => {
    const res = await api.get<{ data: ClientProfitabilityItem[] }>("/analytics/client-profitability");
    return res.data.data;
  },
};
