import apiClient from "./axios";
import type { Project, CreateProjectInput, UpdateProjectInput } from "../types/project";
import type { ApiResponse } from "../types/auth";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";

export const projectsApi = {
  getAll: async (params: ListQueryParams = {}): Promise<PaginatedResponse<Project>> => {
    const response = await apiClient.get<PaginatedResponse<Project>>("/projects", { params });
    return response.data;
  },

  getById: async (id: string): Promise<Project> => {
    const response = await apiClient.get<ApiResponse<Project>>(`/projects/${id}`);
    return response.data.data;
  },

  create: async (data: CreateProjectInput): Promise<Project> => {
    const response = await apiClient.post<ApiResponse<Project>>("/projects", data);
    return response.data.data;
  },

  update: async (id: string, data: Omit<UpdateProjectInput, "id">): Promise<Project> => {
    const response = await apiClient.put<ApiResponse<Project>>(`/projects/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`);
  },
};
