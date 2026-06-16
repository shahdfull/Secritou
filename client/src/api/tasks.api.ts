import apiClient from "./axios";
import type { Task, CreateTaskInput, UpdateTaskInput } from "../types/task";
import type { ApiResponse } from "../types/auth";

export const tasksApi = {
  getAll: async (projectId?: string): Promise<Task[]> => {
    const params = projectId ? { projectId } : {};
    const response = await apiClient.get<ApiResponse<Task[]>>("/tasks", { params });
    return response.data.data;
  },

  getById: async (id: string): Promise<Task> => {
    const response = await apiClient.get<ApiResponse<Task>>(`/tasks/${id}`);
    return response.data.data;
  },

  create: async (data: CreateTaskInput): Promise<Task> => {
    const response = await apiClient.post<ApiResponse<Task>>("/tasks", data);
    return response.data.data;
  },

  update: async (id: string, data: Omit<UpdateTaskInput, "id">): Promise<Task> => {
    const response = await apiClient.put<ApiResponse<Task>>(`/tasks/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/tasks/${id}`);
  },
};
