import apiClient from "./axios";
import type { Client, CreateClientInput, UpdateClientInput } from "../types/client";
import type { ApiResponse } from "../types/auth";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";

export const clientsApi = {
  getAll: async (params: ListQueryParams = {}): Promise<PaginatedResponse<Client>> => {
    const response = await apiClient.get<PaginatedResponse<Client>>("/clients", { params });
    return response.data;
  },

  getById: async (id: string): Promise<Client> => {
    const response = await apiClient.get<ApiResponse<Client>>(`/clients/${id}`);
    return response.data.data;
  },

  create: async (data: CreateClientInput): Promise<Client> => {
    const response = await apiClient.post<ApiResponse<Client>>("/clients", data);
    return response.data.data;
  },

  update: async (id: string, data: Omit<UpdateClientInput, "id">): Promise<Client> => {
    const response = await apiClient.put<ApiResponse<Client>>(`/clients/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/clients/${id}`);
  },

  archive: async (id: string): Promise<Client> => {
    const response = await apiClient.post<ApiResponse<Client>>(`/clients/${id}/archive`);
    return response.data.data;
  },

  invitePortalUser: async (id: string, data: { email: string; name: string }): Promise<{ user: { id: string; email: string; name: string } }> => {
    const response = await apiClient.post<ApiResponse<{ user: { id: string; email: string; name: string } }>>(
      `/clients/${id}/invite`,
      data
    );
    return response.data.data;
  },
};
