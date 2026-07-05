import apiClient from "./axios";
import type { Lead, CreateLeadInput, UpdateLeadInput } from "../types/lead";
import type { ApiResponse } from "../types/auth";
import type { Client } from "../types/client";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";

export const leadsApi = {
  getAll: async (params: ListQueryParams = {}): Promise<PaginatedResponse<Lead>> => {
    const response = await apiClient.get<PaginatedResponse<Lead>>("/leads", { params });
    return response.data;
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

  updateLeadStatus: async (id: string, status: Lead["status"], lostReason?: string): Promise<Lead> => {
    const response = await apiClient.put<ApiResponse<Lead>>(`/leads/${id}`, { status, ...(lostReason ? { lostReason } : {}) });
    return response.data.data;
  },

  reopen: async (id: string): Promise<Lead> => {
    const response = await apiClient.post<ApiResponse<Lead>>(`/leads/${id}/reopen`);
    return response.data.data;
  },
};