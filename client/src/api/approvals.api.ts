import apiClient from "./axios";

export interface Approval {
  id: string;
  title: string;
  description?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMMENTED";
  dueDate?: string;
  clientId: string;
  projectId?: string;
  client?: { name: string };
  attachments?: ApprovalAttachment[];
  timeline?: ApprovalTimeline[];
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalAttachment {
  id: string;
  name: string;
  url: string;
  approvalId: string;
  createdAt: string;
}

export interface ApprovalTimeline {
  id: string;
  action: string;
  comment?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMMENTED";
  userId?: string;
  user?: { name: string };
  approvalId: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const approvalsApi = {
  getApprovals: async (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    clientId?: string;
  }) => {
    const response = await apiClient.get<{ data: PaginatedResponse<Approval> }>("/approvals", {
      params,
    });
    return response.data.data;
  },

  getApprovalById: async (id: string) => {
    const response = await apiClient.get<{ data: Approval }>(`/approvals/${id}`);
    return response.data.data;
  },

  createApproval: async (data: {
    title: string;
    description?: string;
    dueDate?: string;
    clientId: string;
    projectId?: string;
  }) => {
    const response = await apiClient.post<{ data: Approval }>("/approvals", data);
    return response.data.data;
  },

  updateApproval: async (id: string, data: Partial<Approval>) => {
    const response = await apiClient.put<{ data: Approval }>(`/approvals/${id}`, data);
    return response.data.data;
  },

  deleteApproval: async (id: string) => {
    const response = await apiClient.delete<{ data: { success: boolean } }>(
      `/approvals/${id}`
    );
    return response.data.data;
  },

  approve: async (id: string, comment?: string) => {
    const response = await apiClient.post<{ data: Approval }>(`/approvals/${id}/approve`, {
      comment,
    });
    return response.data.data;
  },

  reject: async (id: string, comment?: string) => {
    const response = await apiClient.post<{ data: Approval }>(`/approvals/${id}/reject`, {
      comment,
    });
    return response.data.data;
  },

  comment: async (id: string, comment: string) => {
    const response = await apiClient.post<{ data: Approval }>(`/approvals/${id}/comment`, {
      comment,
    });
    return response.data.data;
  },

  addAttachment: async (id: string, data: { name: string; url: string }) => {
    const response = await apiClient.post<{ data: ApprovalAttachment }>(
      `/approvals/${id}/attachments`,
      data
    );
    return response.data.data;
  },

  deleteAttachment: async (id: string, attachmentId: string) => {
    const response = await apiClient.delete<{ data: { success: boolean } }>(
      `/approvals/${id}/attachments/${attachmentId}`
    );
    return response.data.data;
  },
};
