import apiClient from "./axios";
import type { Client, CreateClientInput, UpdateClientInput } from "../types/client";
import type { ApiResponse } from "../types/auth";

export const clientsApi = {
  getAll: async (): Promise<Client[]> => {
    const response = await apiClient.get<ApiResponse<Client[]>>("/clients");
    return response.data.data;
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
};
