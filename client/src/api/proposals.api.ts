import apiClient from "./axios";

export interface Proposal {
  id: string;
  title: string;
  description?: string;
  status: "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  version: number;
  amount?: number;
  currency: string;
  expiresAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  pdfUrl?: string;
  clientId: string;
  companyId: string;
  projectId?: string;
  serviceRequestId?: string;
  invoice?: { id: string } | null;
  client?: { name: string };
  sections?: ProposalSection[];
  history?: ProposalHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface ProposalSection {
  id: string;
  title: string;
  content?: string;
  orderIndex: number;
  proposalId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalHistory {
  id: string;
  action: string;
  comment?: string;
  userId?: string;
  user?: { name: string };
  proposalId: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const proposalsApi = {
  getProposals: async (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    clientId?: string;
  }) => {
    const response = await apiClient.get<{ data: PaginatedResponse<Proposal> }>("/proposals", {
      params,
    });
    return response.data.data;
  },

  getProposalById: async (id: string) => {
    const response = await apiClient.get<{ data: Proposal }>(`/proposals/${id}`);
    return response.data.data;
  },

  createProposal: async (data: {
    title: string;
    description?: string;
    amount?: number;
    currency?: string;
    expiresAt?: string;
    pdfUrl?: string;
    clientId: string;
    projectId?: string;
    serviceRequestId?: string;
  }) => {
    const response = await apiClient.post<{ data: Proposal }>("/proposals", data);
    return response.data.data;
  },

  updateProposal: async (id: string, data: Partial<Proposal>) => {
    const response = await apiClient.put<{ data: Proposal }>(`/proposals/${id}`, data);
    return response.data.data;
  },

  deleteProposal: async (id: string) => {
    const response = await apiClient.delete<{ data: { success: boolean } }>(
      `/proposals/${id}`
    );
    return response.data.data;
  },

  sendProposal: async (id: string) => {
    const response = await apiClient.post<{ data: Proposal }>(`/proposals/${id}/send`);
    return response.data.data;
  },

  acceptProposal: async (id: string) => {
    const response = await apiClient.post<{ data: Proposal }>(`/proposals/${id}/accept`);
    return response.data.data;
  },

  rejectProposal: async (id: string, comment?: string) => {
    const response = await apiClient.post<{ data: Proposal }>(`/proposals/${id}/reject`, {
      comment,
    });
    return response.data.data;
  },

  addSection: async (id: string, data: { title: string; content?: string; orderIndex: number }) => {
    const response = await apiClient.post<{ data: ProposalSection }>(`/proposals/${id}/sections`, data);
    return response.data.data;
  },

  updateSection: async (id: string, sectionId: string, data: Partial<ProposalSection>) => {
    const response = await apiClient.put<{ data: ProposalSection }>(`/proposals/${id}/sections/${sectionId}`, data);
    return response.data.data;
  },

  deleteSection: async (id: string, sectionId: string) => {
    const response = await apiClient.delete<{ data: { success: boolean } }>(`/proposals/${id}/sections/${sectionId}`);
    return response.data.data;
  },

  createInvoiceFromProposal: async (proposalId: string) => {
    const response = await apiClient.post<{ data: { id: string } }>(`/proposals/${proposalId}/create-invoice`);
    return response.data.data;
  },
};
