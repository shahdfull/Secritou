import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  enhancedDocumentsApi,
  type EnhancedDocument,
  type PaginatedResponse,
} from "../api/enhancedDocuments.api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function useEnhancedDocuments(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
  clientId?: string;
  tags?: string[];
}) {
  return useQuery<PaginatedResponse<EnhancedDocument>>({
    queryKey: ["enhancedDocuments", params],
    queryFn: () => enhancedDocumentsApi.getDocuments(params),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}

export function useEnhancedDocument(id: string) {
  return useQuery<EnhancedDocument>({
    queryKey: ["enhancedDocument", id],
    queryFn: () => enhancedDocumentsApi.getDocumentById(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCreateEnhancedDocument() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<EnhancedDocument, Error, Parameters<typeof enhancedDocumentsApi.createDocument>[0]>({
    mutationFn: (data) => enhancedDocumentsApi.createDocument(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enhancedDocuments"] });
      toast.success(t("documents.created"));
    },
  });
}

export function useUpdateEnhancedDocument() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<EnhancedDocument, Error, { id: string; data: Partial<EnhancedDocument> }>({
    mutationFn: ({ id, data }) => enhancedDocumentsApi.updateDocument(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enhancedDocuments"] });
      toast.success(t("documents.updated"));
    },
  });
}

export function useDeleteEnhancedDocument() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (id) => enhancedDocumentsApi.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enhancedDocuments"] });
      toast.success(t("documents.deleted"));
    },
  });
}

export function useCreateDocumentVersion() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<EnhancedDocument, Error, { id: string; data: { url: string } }>({
    mutationFn: ({ id, data }) => enhancedDocumentsApi.createVersion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enhancedDocuments"] });
      toast.success(t("documents.versionCreated"));
    },
  });
}
