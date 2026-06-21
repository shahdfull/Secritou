import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "@/i18n";
import {
  customQuestionsApi,
  type CustomQuestionStatus,
} from "../api/customQuestions.api";

const keys = {
  my: (page?: number) => ["customQuestions", "my", page ?? 1] as const,
  all: (status?: string, page?: number) => ["customQuestions", "all", status ?? "", page ?? 1] as const,
  detail: (id: string) => ["customQuestions", "detail", id] as const,
};

// ── Client: my questions ────────────────────────────────────────────────────
export function useMyQuestions(page = 1) {
  return useQuery({
    queryKey: keys.my(page),
    queryFn: () => customQuestionsApi.getMy({ page }),
  });
}

// ── Admin: all questions ────────────────────────────────────────────────────
export function useAllQuestions(status?: string, page = 1) {
  return useQuery({
    queryKey: keys.all(status, page),
    queryFn: () => customQuestionsApi.getAll({ status, page }),
  });
}

// ── Single question + thread ────────────────────────────────────────────────
export function useQuestion(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ""),
    queryFn: () => customQuestionsApi.getById(id as string),
    enabled: Boolean(id),
  });
}

// ── Create a question ───────────────────────────────────────────────────────
export function useCreateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { subject: string; message: string }) => customQuestionsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customQuestions"] });
      toast.success(i18n.t("questions.dialog.success"));
    },
    onError: (error: Error) => {
      toast.error(error.message ?? i18n.t("errors.generic", "Une erreur est survenue"));
    },
  });
}

// ── Add a message to a thread ───────────────────────────────────────────────
export function useAddQuestionMessage(questionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => customQuestionsApi.addMessage(questionId, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.detail(questionId) });
      qc.invalidateQueries({ queryKey: ["customQuestions"] });
    },
    onError: (error: Error) => {
      toast.error(error.message ?? i18n.t("errors.generic", "Une erreur est survenue"));
    },
  });
}

// ── Admin: update status ────────────────────────────────────────────────────
export function useUpdateQuestionStatus(questionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: CustomQuestionStatus) =>
      customQuestionsApi.updateStatus(questionId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.detail(questionId) });
      qc.invalidateQueries({ queryKey: ["customQuestions"] });
    },
    onError: (error: Error) => {
      toast.error(error.message ?? i18n.t("errors.generic", "Une erreur est survenue"));
    },
  });
}
