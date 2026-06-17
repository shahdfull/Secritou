import apiClient from "./axios";
import type { ApiResponse } from "../types/auth";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const aiApi = {
  chat: async (message: string, history: ChatMessage[]): Promise<string> => {
    const response = await apiClient.post<ApiResponse<{ message: string }>>("/ai/chat", {
      message,
      history,
    });
    return response.data.data.message;
  },
};
