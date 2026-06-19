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
    { conversation: AiConversation; reply: AiMessage },
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
  return useMutation<{ reply: AiMessage }, Error, { id: string; message: string }>({
    mutationFn: ({ id, message }) => aiConversationsApi.addMessage(id, message),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(variables.id) });
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
  });
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
