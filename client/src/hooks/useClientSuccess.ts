import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clientSuccessApi,
  type ClientSuccess,
} from "../api/clientSuccess.api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function useClientSuccess(clientId: string) {
  return useQuery<ClientSuccess>({
    queryKey: ["clientSuccess", clientId],
    queryFn: () => clientSuccessApi.getClientSuccess(clientId),
    enabled: !!clientId,
    staleTime: 60_000,
  });
}

export function useCalculateClientSuccessScore() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<{ score: number }, Error, string>({
    mutationFn: (clientId) => clientSuccessApi.calculateScore(clientId),
    onSuccess: (_, clientId) => {
      queryClient.invalidateQueries({ queryKey: ["clientSuccess", clientId] });
      toast.success(t("clientSuccess.scoreCalculated"));
    },
  });
}

export function useAddSuccessObjective() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<any, Error, { clientId: string; data: any }>({
    mutationFn: ({ clientId, data }) => clientSuccessApi.addObjective(clientId, data),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientSuccess", clientId] });
      toast.success(t("clientSuccess.objectiveAdded"));
    },
  });
}

export function useUpdateSuccessObjective() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<any, Error, { clientId: string; objectiveId: string; data: any }>({
    mutationFn: ({ clientId, objectiveId, data }) =>
      clientSuccessApi.updateObjective(clientId, objectiveId, data),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientSuccess", clientId] });
      toast.success(t("clientSuccess.objectiveUpdated"));
    },
  });
}

export function useDeleteSuccessObjective() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<any, Error, { clientId: string; objectiveId: string }>({
    mutationFn: ({ clientId, objectiveId }) =>
      clientSuccessApi.deleteObjective(clientId, objectiveId),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientSuccess", clientId] });
      toast.success(t("clientSuccess.objectiveDeleted"));
    },
  });
}

export function useAddSuccessMetric() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<any, Error, { clientId: string; data: any }>({
    mutationFn: ({ clientId, data }) => clientSuccessApi.addMetric(clientId, data),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientSuccess", clientId] });
      toast.success(t("clientSuccess.metricAdded"));
    },
  });
}

export function useUpdateSuccessMetric() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<any, Error, { clientId: string; metricId: string; data: any }>({
    mutationFn: ({ clientId, metricId, data }) =>
      clientSuccessApi.updateMetric(clientId, metricId, data),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientSuccess", clientId] });
      toast.success(t("clientSuccess.metricUpdated"));
    },
  });
}

export function useDeleteSuccessMetric() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<any, Error, { clientId: string; metricId: string }>({
    mutationFn: ({ clientId, metricId }) =>
      clientSuccessApi.deleteMetric(clientId, metricId),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientSuccess", clientId] });
      toast.success(t("clientSuccess.metricDeleted"));
    },
  });
}

export function useAddSuccessRecommendation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<any, Error, { clientId: string; data: any }>({
    mutationFn: ({ clientId, data }) => clientSuccessApi.addRecommendation(clientId, data),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientSuccess", clientId] });
      toast.success(t("clientSuccess.recommendationAdded"));
    },
  });
}

export function useUpdateSuccessRecommendation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<any, Error, { clientId: string; recommendationId: string; data: any }>({
    mutationFn: ({ clientId, recommendationId, data }) =>
      clientSuccessApi.updateRecommendation(clientId, recommendationId, data),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientSuccess", clientId] });
      toast.success(t("clientSuccess.recommendationUpdated"));
    },
  });
}

export function useDeleteSuccessRecommendation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<any, Error, { clientId: string; recommendationId: string }>({
    mutationFn: ({ clientId, recommendationId }) =>
      clientSuccessApi.deleteRecommendation(clientId, recommendationId),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientSuccess", clientId] });
      toast.success(t("clientSuccess.recommendationDeleted"));
    },
  });
}

export function useAddSuccessTimeline() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<any, Error, { clientId: string; data: any }>({
    mutationFn: ({ clientId, data }) => clientSuccessApi.addTimeline(clientId, data),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientSuccess", clientId] });
      toast.success(t("clientSuccess.timelineAdded"));
    },
  });
}

export function useDeleteSuccessTimeline() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<any, Error, { clientId: string; timelineId: string }>({
    mutationFn: ({ clientId, timelineId }) =>
      clientSuccessApi.deleteTimeline(clientId, timelineId),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientSuccess", clientId] });
      toast.success(t("clientSuccess.timelineDeleted"));
    },
  });
}
