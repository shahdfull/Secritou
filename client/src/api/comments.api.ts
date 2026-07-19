import apiClient from "./axios";
import type { Comment, CreateCommentInput } from "../types/comment";
import type { ApiResponse } from "../types/auth";

export const commentsApi = {
  getByTaskId: async (taskId: string): Promise<Comment[]> => {
    const response = await apiClient.get<ApiResponse<Comment[]>>(`/tasks/${taskId}/comments`);
    return response.data.data;
  },

  create: async (taskId: string, data: CreateCommentInput): Promise<Comment> => {
    const response = await apiClient.post<ApiResponse<Comment>>(`/tasks/${taskId}/comments`, data);
    return response.data.data;
  },

  update: async (taskId: string, commentId: string, content: string): Promise<Comment> => {
    const response = await apiClient.put<ApiResponse<Comment>>(`/tasks/${taskId}/comments/${commentId}`, { content });
    return response.data.data;
  },

  delete: async (taskId: string, commentId: string): Promise<void> => {
    await apiClient.delete(`/tasks/${taskId}/comments/${commentId}`);
  },
};
