import apiClient from "./axios";

export type ContactRequest = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  serviceType: string;
  budget?: string | null;
  company: string;
  message: string;
  status: "NEW" | "READ" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
};

export type PaginatedContactRequests = {
  data: ContactRequest[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export const contactRequestsApi = {
  getAll: async (params: { status?: string; page?: number; limit?: number } = {}): Promise<PaginatedContactRequests> => {
    const search = new URLSearchParams();
    if (params.status) search.set("status", params.status);
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    const qs = search.toString();
    const response = await apiClient.get<PaginatedContactRequests>(`/contact${qs ? `?${qs}` : ""}`);
    return response.data;
  },
  updateStatus: async (id: string, status: ContactRequest["status"]): Promise<ContactRequest> => {
    const response = await apiClient.patch<ContactRequest>(`/contact/${id}`, { status });
    return response.data;
  },
};
