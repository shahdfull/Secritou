import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiConversationsApi, type AiConversation, type AiMessage } from "@/api/aiConversations.api";
import { toast } from "sonner";
import i18n from "@/i18n";

const KEYS = {
  list: (page: number) => ["ai-conversations", page] as const,
  detail: (id: string) => ["ai-conversation", id] as const,
};

export function useAiConversations(page = 1) {
  return useQuery({
    queryKey: KEYS.list(page),
    queryFn: () => aiConversationsApi.list(page, 20),
    staleTime: 30_000,
  });
}

export function useAiConversation(id: string | null) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ""),
    queryFn: () => aiConversationsApi.get(id!),
    enabled: !!id,
    staleTime: 0, // always fresh when switching conversations
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation<
    { conversation: AiConversation; reply: AiMessage; durationMs?: number },
    Error,
    string
  >({
    mutationFn: (message) => aiConversationsApi.create(message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
  });
}

export function useAddMessage() {
  const qc = useQueryClient();
  return useMutation<{ reply: AiMessage; durationMs?: number }, Error, { id: string; message: string }>({
    mutationFn: ({ id, message }) => aiConversationsApi.addMessage(id, message),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(variables.id) });
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
  });
}

// SEC-059 follow-up: exposes streamingText (accumulated so far) while a stream is in flight —
// a plain useMutation can't expose incremental state like this, since its lifecycle is only
// pending/success/error, not "success, but here's what's arrived so far". Callers render
// streamingText while isStreaming is true, then switch to the persisted AiMessage (via the
// invalidated ["ai-conversation", id] query) once onSuccess fires — matching the non-streaming
// useAddMessage's own cache-invalidation contract exactly, so a caller can swap between the two
// without changing how it reacts to completion.
export function useStreamMessage() {
  const qc = useQueryClient();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const mutation = useMutation<{ reply: AiMessage; durationMs?: number }, Error, { id: string; message: string }>({
    mutationFn: ({ id, message }) => {
      setIsStreaming(true);
      setStreamingText("");
      const controller = new AbortController();
      abortRef.current = controller;
      return aiConversationsApi.streamMessage(
        id,
        message,
        (delta) => setStreamingText((prev) => prev + delta),
        controller.signal
      );
    },
    onSettled: (_data, _error, variables) => {
      setIsStreaming(false);
      abortRef.current = null;
      qc.invalidateQueries({ queryKey: KEYS.detail(variables.id) });
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
  });

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { ...mutation, isStreaming, streamingText, cancel };
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => aiConversationsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
      toast.success(i18n.t("toasts.conversationDeleted"));
    },
  });
}

export function useImportFromLocalStorage() {
  const qc = useQueryClient();
  return useMutation<
    AiConversation,
    Error,
    { role: "user" | "assistant"; content: string }[]
  >({
    mutationFn: (messages) => aiConversationsApi.importFromLocalStorage(messages),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
  });
}
