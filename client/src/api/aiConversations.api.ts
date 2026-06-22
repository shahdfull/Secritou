import apiClient from "./axios";

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  conversationId: string;
  createdAt: string;
}

export interface AiConversation {
  id: string;
  title: string;
  userId: string;
  messages: AiMessage[];
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

export interface PaginatedConversations {
  data: Omit<AiConversation, "messages">[];
  total: number;
  page: number;
  pageSize: number;
}

export const aiConversationsApi = {
  list: async (page = 1, pageSize = 20): Promise<PaginatedConversations> => {
    const res = await apiClient.get<PaginatedConversations>("/ai/conversations", {
      params: { page, pageSize },
    });
    return res.data;
  },

  get: async (id: string): Promise<AiConversation> => {
    const res = await apiClient.get<{ data: AiConversation }>(`/ai/conversations/${id}`);
    return res.data.data;
  },

  create: async (message: string): Promise<{ conversation: AiConversation; reply: AiMessage }> => {
    const res = await apiClient.post<{ data: { conversation: AiConversation; reply: AiMessage } }>(
      "/ai/conversations",
      { message }
    );
    return res.data.data;
  },

  addMessage: async (id: string, message: string): Promise<{ reply: AiMessage }> => {
    const res = await apiClient.post<{ data: { reply: AiMessage } }>(
      `/ai/conversations/${id}/messages`,
      { message }
    );
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/ai/conversations/${id}`);
  },

  importFromLocalStorage: async (
    messages: { role: "user" | "assistant"; content: string }[]
  ): Promise<AiConversation> => {
    const res = await apiClient.post<{ data: AiConversation }>("/ai/conversations/import", {
      messages,
    });
    return res.data.data;
  },
};
