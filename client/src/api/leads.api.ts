import apiClient from "./axios";
import type { Lead, CreateLeadInput, UpdateLeadInput } from "../types/lead";
import type { ApiResponse } from "../types/auth";
import type { Client } from "../types/client";

export const leadsApi = {
  getAll: async (): Promise<Lead[]> => {
    const response = await apiClient.get<ApiResponse<Lead[]>>("/leads");
    return response.data.data;
  },

  getById: async (id: string): Promise<Lead> => {
    const response = await apiClient.get<ApiResponse<Lead>>(`/leads/${id}`);
    return response.data.data;
  },

  create: async (data: CreateLeadInput): Promise<Lead> => {
    const response = await apiClient.post<ApiResponse<Lead>>("/leads", data);
    return response.data.data;
  },

  update: async (id: string, data: Omit<UpdateLeadInput, "id">): Promise<Lead> => {
    const response = await apiClient.put<ApiResponse<Lead>>(`/leads/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/leads/${id}`);
  },

  convertToClient: async (id: string): Promise<Client> => {
    const response = await apiClient.post<ApiResponse<Client>>(`/leads/${id}/convert`);
    return response.data.data;
  },
};
