import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commissionsApi, type PaginatedResponse, type Commission } from "../api/commissions.api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function useCommissionSplits(projectId: string) {
  return useQuery({
    queryKey: ["commissionSplits", projectId],
    queryFn: () => commissionsApi.getSplits(projectId),
    enabled: !!projectId,
  });
}

export function useSetCommissionSplits(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (splits: { partnerId: string; ratePct: number }[]) => commissionsApi.setSplits(projectId, splits),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commissionSplits", projectId] });
      toast.success(t("commissions.splitsUpdated", "Répartition mise à jour"));
    },
  });
}

export function useResetSplitToAuto(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: () => commissionsApi.resetToAuto(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commissionSplits", projectId] });
      toast.success(t("commissions.resetToAutoDone", "Calcul automatique réactivé"));
    },
  });
}

export function useCommissionSplitHistory(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["commissionSplitHistory", projectId],
    queryFn: () => commissionsApi.getSplitHistory(projectId),
    enabled: enabled && !!projectId,
  });
}

// RG-006 (refonte paiement à la tâche) : le CEO fixe explicitement l'enveloppe — le
// pré-remplissage suggéré (65% de la proposition) n'est jamais envoyé automatiquement ici,
// seulement affiché côté composant ; ce hook n'écrit que la valeur que le CEO valide.
export function useSetPayoutBudget(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payoutBudget: number | null) => commissionsApi.setPayoutBudget(projectId, payoutBudget),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commissionSplits", projectId] });
      toast.success(t("commissions.payoutBudgetUpdated", "Enveloppe de rémunération mise à jour"));
    },
  });
}

export function useCommissions(params?: { page?: number; pageSize?: number; partnerId?: string; status?: string }, enabled = true) {
  return useQuery<PaginatedResponse<Commission>>({
    queryKey: ["commissions", params],
    queryFn: () => commissionsApi.getCommissions(params),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
    enabled,
  });
}

export function useCommissionsOwedSummary(enabled = true) {
  return useQuery({
    queryKey: ["commissionsOwedSummary"],
    queryFn: () => commissionsApi.getOwedSummary(),
    staleTime: 60_000,
    enabled,
  });
}

export function useMyCommissions(params?: { page?: number; pageSize?: number; status?: string }, enabled = true) {
  return useQuery<PaginatedResponse<Commission>>({
    queryKey: ["myCommissions", params],
    queryFn: () => commissionsApi.getMyCommissions(params),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
    enabled,
  });
}

export function useMyCommissionsOwedSummary(enabled = true) {
  return useQuery({
    queryKey: ["myCommissionsOwedSummary"],
    queryFn: () => commissionsApi.getMyOwedSummary(),
    staleTime: 60_000,
    enabled,
  });
}

export function useMySplitForProject(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["mySplitForProject", projectId],
    queryFn: () => commissionsApi.getMySplitForProject(projectId),
    staleTime: 60_000,
    enabled: enabled && !!projectId,
  });
}

export function useMarkCommissionPaid() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: string) => commissionsApi.markPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commissions"] });
      queryClient.invalidateQueries({ queryKey: ["commissionsOwedSummary"] });
      toast.success(t("commissions.markedPaid", "Commission marquée comme payée"));
    },
  });
}
