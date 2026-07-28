import apiClient from "./axios";

export interface CommissionSplit {
  id: string;
  projectId: string;
  partnerId: string;
  ratePct: number;
  partner?: { id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface Commission {
  id: string;
  partnerId: string;
  projectId: string;
  invoiceId: string;
  paymentId: string;
  basis: number;
  ratePct: number;
  amount: number;
  status: "PENDING" | "PAID";
  paidAt?: string;
  createdAt: string;
  partner?: { id: string; name: string; email: string };
  project?: { id: string; name: string };
  invoice?: { id: string; number: string };
}

export interface CommissionOwedSummary {
  partnerId: string;
  pending: number;
  paid: number;
}

export type CommissionSplitMode = "AUTO" | "MANUAL";

export interface CommissionSplitState {
  splits: CommissionSplit[];
  commissionSplitMode: CommissionSplitMode;
  commissionSplitDesynced: boolean;
  // RG-006 (refonte paiement à la tâche) : enveloppe maximale versable sur le projet, fixée
  // explicitement par le CEO (null tant qu'elle n'est pas fixée).
  payoutBudget: number | null;
  // Suggestion calculée à 65% du montant de la proposition acceptée — jamais persistée
  // automatiquement, seulement affichée comme pré-remplissage que le CEO doit valider.
  suggestedPayoutBudget: number | null;
}

export interface CommissionSplitHistoryEntry {
  id: string;
  projectId: string;
  trigger: "AUTO_RECALC" | "MANUAL_EDIT" | "MODE_RESET_TO_AUTO";
  previousSplits: { partnerId: string; ratePct: number }[];
  newSplits: { partnerId: string; ratePct: number }[];
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const commissionsApi = {
  getSplits: async (projectId: string): Promise<CommissionSplitState> => {
    const response = await apiClient.get<{
      data: CommissionSplit[];
      commissionSplitMode: CommissionSplitMode;
      commissionSplitDesynced: boolean;
      payoutBudget: number | null;
      suggestedPayoutBudget: number | null;
    }>(`/commissions/projects/${projectId}/splits`);
    return {
      splits: response.data.data,
      commissionSplitMode: response.data.commissionSplitMode,
      commissionSplitDesynced: response.data.commissionSplitDesynced,
      payoutBudget: response.data.payoutBudget,
      suggestedPayoutBudget: response.data.suggestedPayoutBudget,
    };
  },

  setPayoutBudget: async (projectId: string, payoutBudget: number | null): Promise<{ id: string; payoutBudget: number | null }> => {
    const response = await apiClient.put<{ data: { id: string; payoutBudget: number | null } }>(
      `/commissions/projects/${projectId}/payout-budget`,
      { payoutBudget }
    );
    return response.data.data;
  },

  setSplits: async (projectId: string, splits: { partnerId: string; ratePct: number }[]): Promise<CommissionSplit[]> => {
    const response = await apiClient.put<{ data: CommissionSplit[] }>(`/commissions/projects/${projectId}/splits`, { splits });
    return response.data.data;
  },

  resetToAuto: async (projectId: string): Promise<CommissionSplit[]> => {
    const response = await apiClient.post<{ data: CommissionSplit[] }>(`/commissions/projects/${projectId}/reset-to-auto`);
    return response.data.data;
  },

  getSplitHistory: async (projectId: string): Promise<CommissionSplitHistoryEntry[]> => {
    const response = await apiClient.get<{ data: CommissionSplitHistoryEntry[] }>(`/commissions/projects/${projectId}/history`);
    return response.data.data;
  },

  getCommissions: async (params?: { page?: number; pageSize?: number; partnerId?: string; status?: string }): Promise<PaginatedResponse<Commission>> => {
    const response = await apiClient.get<PaginatedResponse<Commission>>("/commissions", { params });
    return response.data;
  },

  getOwedSummary: async (): Promise<CommissionOwedSummary[]> => {
    const response = await apiClient.get<{ data: CommissionOwedSummary[] }>("/commissions/summary");
    return response.data.data;
  },

  getMyCommissions: async (params?: { page?: number; pageSize?: number; status?: string }): Promise<PaginatedResponse<Commission>> => {
    const response = await apiClient.get<PaginatedResponse<Commission>>("/commissions/my", { params });
    return response.data;
  },

  getMyOwedSummary: async (): Promise<CommissionOwedSummary> => {
    const response = await apiClient.get<{ data: CommissionOwedSummary }>("/commissions/my/summary");
    return response.data.data;
  },

  getMySplitForProject: async (projectId: string): Promise<CommissionSplit | null> => {
    const response = await apiClient.get<{ data: CommissionSplit | null }>(`/commissions/projects/${projectId}/my-split`);
    return response.data.data;
  },

  markPaid: async (id: string): Promise<Commission> => {
    const response = await apiClient.post<{ data: Commission }>(`/commissions/${id}/mark-paid`);
    return response.data.data;
  },
};
