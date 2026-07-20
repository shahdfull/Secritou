import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  documentsApi,
  type Document,
  type DocumentType,
  type PaginatedResponse,
} from "../api/documents.api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { getServerErrorMessage } from "@/utils/apiError";

export function useDocuments(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: DocumentType;
  clientId?: string;
  projectId?: string;
  taskId?: string;
  tags?: string[];
}) {
  return useQuery<PaginatedResponse<Document>>({
    queryKey: ["documents", params],
    queryFn: () => documentsApi.getDocuments(params),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}

export function useDocument(id: string) {
  return useQuery<Document>({
    queryKey: ["document", id],
    queryFn: () => documentsApi.getDocumentById(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}

// SEC-095: none of the three mutations below had an onError at all — a rejection (e.g. 403
// FREELANCER_DELIVERABLE_ONLY, or 409 on a task whose project is archived) failed completely
// silently, with nothing shown to the user across all 3 consumers of this hook (DocumentsPage,
// ProjectDetailPage, TaskAttachments).
function showDocumentError(fallback: string) {
  return (err: unknown) => {
    toast.error(getServerErrorMessage(err) || fallback);
  };
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Document, Error, Parameters<typeof documentsApi.createDocument>[0]>({
    mutationFn: (data) => documentsApi.createDocument(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success(t("documents.created"));
    },
    onError: showDocumentError(t("documents.createError")),
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Document, Error, { id: string; data: Partial<Document> }>({
    mutationFn: ({ id, data }) => documentsApi.updateDocument(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success(t("documents.updated"));
    },
    onError: showDocumentError(t("documents.updateError")),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (id) => documentsApi.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success(t("documents.deleted"));
    },
    onError: showDocumentError(t("documents.deleteError")),
  });
}

export function useDownloadDocument() {
  const { t } = useTranslation();

  return useMutation<{ url: string; filename: string }, Error, string>({
    mutationFn: (id) => documentsApi.getDownloadUrl(id),
    onError: () => {
      toast.error(t("documents.downloadError"));
    },
  });
}

export function useCreateDocumentVersion() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Document, Error, { id: string; data: { url: string } }>({
    mutationFn: ({ id, data }) => documentsApi.createVersion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success(t("documents.versionCreated"));
    },
  });
}
