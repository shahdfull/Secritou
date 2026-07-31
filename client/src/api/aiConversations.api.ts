import apiClient from "./axios";
import { useAuthStore } from "../store/auth.store";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/v1";

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

  create: async (message: string): Promise<{ conversation: AiConversation; reply: AiMessage; durationMs?: number }> => {
    const res = await apiClient.post<{ data: { conversation: AiConversation; reply: AiMessage; durationMs?: number } }>(
      "/ai/conversations",
      { message }
    );
    return res.data.data;
  },

  addMessage: async (id: string, message: string): Promise<{ reply: AiMessage; durationMs?: number }> => {
    const res = await apiClient.post<{ data: { reply: AiMessage; durationMs?: number } }>(
      `/ai/conversations/${id}/messages`,
      { message }
    );
    return res.data.data;
  },

  // SEC-059 follow-up: SSE variant of addMessage — plain fetch rather than axios (axios has no
  // built-in streaming body reader in the browser, and EventSource can't send an Authorization
  // header), reproducing the same auth as axios.ts's interceptor (Bearer token + cookies for the
  // HTTP-only refresh flow) by hand. onChunk fires for each text delta as it streams in; the
  // returned promise resolves with the same { reply } shape as addMessage once the stream ends,
  // or rejects if the server reports an "error" SSE event or the connection itself fails.
  streamMessage: async (
    id: string,
    message: string,
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<{ reply: AiMessage; durationMs?: number }> => {
    const accessToken = useAuthStore.getState().accessToken;
    const response = await fetch(`${API_BASE_URL}/ai/conversations/${id}/messages/stream`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ message }),
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`AI stream request failed with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result: { reply: AiMessage; durationMs?: number } | undefined;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line ("\n\n") — each frame has an "event:" line and
        // a "data:" line, matching exactly what aiConversation.controller.ts#addMessageStream writes.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const eventLine = frame.split("\n").find((l) => l.startsWith("event:"));
          const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!eventLine || !dataLine) continue;
          const eventType = eventLine.slice("event:".length).trim();
          const data = JSON.parse(dataLine.slice("data:".length).trim()) as
            | { text: string }
            | { data: { reply: AiMessage; durationMs?: number } }
            | { message: string };

          if (eventType === "chunk" && "text" in data) {
            onChunk(data.text);
          } else if (eventType === "done" && "data" in data) {
            result = data.data;
          } else if (eventType === "error" && "message" in data) {
            throw new Error(data.message);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!result) {
      throw new Error("AI stream ended without a final reply");
    }
    return result;
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
