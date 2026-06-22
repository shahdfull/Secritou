import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  documentsApi,
  type Document,
  type PaginatedResponse,
} from "../api/documents.api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function useDocuments(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: any;
  clientId?: string;
  projectId?: string;
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

export function useCreateDocument() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Document, Error, Parameters<typeof documentsApi.createDocument>[0]>({
    mutationFn: (data) => documentsApi.createDocument(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success(t("documents.created"));
    },
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
