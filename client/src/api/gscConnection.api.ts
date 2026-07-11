import apiClient from "./axios";

export interface GscStatus {
  connected: boolean;
  siteUrl?: string;
  lastSyncedAt?: string;
  lastSyncError?: string | null;
}

export interface MetricSnapshotRow {
  id: string;
  clientId: string;
  projectId?: string | null;
  source: "GSC" | "GA4" | "META" | "GADS";
  metric: string;
  value: number;
  dimension: string;
  periodStart: string;
  periodEnd: string;
}

export const gscConnectionApi = {
  getStatus: async (clientId: string): Promise<GscStatus> => {
    const response = await apiClient.get<{ data: GscStatus }>(`/integrations/gsc/clients/${clientId}/status`);
    return response.data.data;
  },

  startConnect: async (clientId: string): Promise<{ url: string }> => {
    const response = await apiClient.post<{ data: { url: string } }>(`/integrations/gsc/clients/${clientId}/connect`);
    return response.data.data;
  },

  completeConnect: async (clientId: string, pendingId: string, siteUrl: string): Promise<void> => {
    await apiClient.post(`/integrations/gsc/clients/${clientId}/complete`, { pendingId, siteUrl });
  },

  disconnect: async (clientId: string): Promise<void> => {
    await apiClient.delete(`/integrations/gsc/clients/${clientId}`);
  },

  getMetrics: async (clientId: string, params?: { metric?: string; from?: string; to?: string }): Promise<MetricSnapshotRow[]> => {
    const response = await apiClient.get<{ data: MetricSnapshotRow[] }>(`/integrations/gsc/clients/${clientId}/metrics`, { params });
    return response.data.data;
  },
};
