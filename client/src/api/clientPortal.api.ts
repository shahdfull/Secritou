import apiClient from "./axios";
import type { GscStatus, MetricSnapshotRow } from "./gscConnection.api";

export interface ClientPortalSummary {
  outstandingBalance: number;
  nextDueInvoice: {
    id: string;
    number: string;
    dueDate: string | null;
    amount: number;
    amountPaid: number;
    currency: string;
  } | null;
  currentProject: {
    projectId: string;
    projectName: string;
    progress: number;
  } | null;
}

export const clientPortalApi = {
  getSummary: async () => {
    const response = await apiClient.get<{ data: ClientPortalSummary }>("/client-portal/summary");
    return response.data.data;
  },

  getSeoStatus: async (): Promise<GscStatus> => {
    const response = await apiClient.get<{ data: GscStatus }>("/client-portal/seo/status");
    return response.data.data;
  },

  getSeoMetrics: async (): Promise<MetricSnapshotRow[]> => {
    const response = await apiClient.get<{ data: MetricSnapshotRow[] }>("/client-portal/seo/metrics");
    return response.data.data;
  },
};
