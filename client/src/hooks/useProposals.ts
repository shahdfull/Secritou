import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  proposalsApi,
  type Proposal,
  type PaginatedResponse,
} from "../api/proposals.api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function useProposals(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  clientId?: string;
}) {
  return useQuery<PaginatedResponse<Proposal>>({
    queryKey: ["proposals", params],
    queryFn: async () => {
      const response = await proposalsApi.getProposals(params);
      // Ensure all pagination fields have valid fallbacks
      return {
        data: response.data ?? [],
        page: response.page ?? 1,
        pageSize: response.pageSize ?? 10,
        total: response.total ?? 0,
      };
    },
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}

export function useProposal(id: string) {
  return useQuery<Proposal>({
    queryKey: ["proposal", id],
    queryFn: () => proposalsApi.getProposalById(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCreateProposal() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Proposal, Error, Parameters<typeof proposalsApi.createProposal>[0]>({
    mutationFn: (data) => proposalsApi.createProposal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      toast.success(t("proposals.created"));
    },
  });
}

export function useUpdateProposal() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Proposal, Error, { id: string; data: Partial<Proposal> }>({
    mutationFn: ({ id, data }) => proposalsApi.updateProposal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      toast.success(t("proposals.updated"));
    },
  });
}

export function useDeleteProposal() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (id) => proposalsApi.deleteProposal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      toast.success(t("proposals.deleted"));
    },
  });
}

export function useSendProposal() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Proposal, Error, string>({
    mutationFn: (id) => proposalsApi.sendProposal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      toast.success(t("proposals.sent"));
    },
  });
}

export function useAcceptProposal() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Proposal, Error, string>({
    mutationFn: (id) => proposalsApi.acceptProposal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      toast.success(t("proposals.accepted"));
    },
  });
}

export function useRejectProposal() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Proposal, Error, { id: string; comment?: string }>({
    mutationFn: ({ id, comment }) => proposalsApi.rejectProposal(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      toast.success(t("proposals.rejected"));
    },
  });
}
