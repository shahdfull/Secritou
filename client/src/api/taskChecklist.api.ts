import apiClient from "./axios";
import type { ApiResponse } from "../types/auth";

export interface TaskChecklistItem {
  id: string;
  title: string;
  done: boolean;
  position: number;
  taskId: string;
  createdAt: string;
  updatedAt: string;
}

export const taskChecklistApi = {
  getByTaskId: async (taskId: string): Promise<TaskChecklistItem[]> => {
    const response = await apiClient.get<ApiResponse<TaskChecklistItem[]>>(`/tasks/${taskId}/checklist`);
    return response.data.data;
  },

  create: async (taskId: string, title: string): Promise<TaskChecklistItem> => {
    const response = await apiClient.post<ApiResponse<TaskChecklistItem>>(`/tasks/${taskId}/checklist`, { title });
    return response.data.data;
  },

  update: async (taskId: string, itemId: string, data: { title?: string; done?: boolean }): Promise<TaskChecklistItem> => {
    const response = await apiClient.put<ApiResponse<TaskChecklistItem>>(`/tasks/${taskId}/checklist/${itemId}`, data);
    return response.data.data;
  },

  delete: async (taskId: string, itemId: string): Promise<void> => {
    await apiClient.delete(`/tasks/${taskId}/checklist/${itemId}`);
  },
};
