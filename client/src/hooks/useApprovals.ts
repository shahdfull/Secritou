import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approvalsApi,
  type Approval,
  type PaginatedResponse,
} from "../api/approvals.api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function useApprovals(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  clientId?: string;
}) {
  return useQuery<PaginatedResponse<Approval>>({
    queryKey: ["approvals", params],
    queryFn: () => approvalsApi.getApprovals(params),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}

export function useApproval(id: string) {
  return useQuery<Approval>({
    queryKey: ["approval", id],
    queryFn: () => approvalsApi.getApprovalById(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCreateApproval() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Approval, Error, Parameters<typeof approvalsApi.createApproval>[0]>({
    mutationFn: (data) => approvalsApi.createApproval(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      toast.success(t("approvals.created"));
    },
  });
}

export function useUpdateApproval() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Approval, Error, { id: string; data: Partial<Approval> }>({
    mutationFn: ({ id, data }) => approvalsApi.updateApproval(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      toast.success(t("approvals.updated"));
    },
  });
}

export function useDeleteApproval() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (id) => approvalsApi.deleteApproval(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      toast.success(t("approvals.deleted"));
    },
  });
}

export function useApproveApproval() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Approval, Error, { id: string; comment?: string }>({
    mutationFn: ({ id, comment }) => approvalsApi.approve(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      toast.success(t("approvals.approved"));
    },
  });
}

export function useRejectApproval() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Approval, Error, { id: string; comment?: string }>({
    mutationFn: ({ id, comment }) => approvalsApi.reject(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      toast.success(t("approvals.rejected"));
    },
  });
}

export function useCommentApproval() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Approval, Error, { id: string; comment: string }>({
    mutationFn: ({ id, comment }) => approvalsApi.comment(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      toast.success(t("approvals.commented"));
    },
  });
}
