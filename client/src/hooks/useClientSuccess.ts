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

type AddObjectiveData = Parameters<typeof clientSuccessApi.addObjective>[1];
type UpdateObjectiveData = Parameters<typeof clientSuccessApi.updateObjective>[2];
type AddObjectiveResult = Awaited<ReturnType<typeof clientSuccessApi.addObjective>>;
type UpdateObjectiveResult = Awaited<ReturnType<typeof clientSuccessApi.updateObjective>>;
type DeleteObjectiveResult = Awaited<ReturnType<typeof clientSuccessApi.deleteObjective>>;

export function useAddSuccessObjective() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<AddObjectiveResult, Error, { clientId: string; data: AddObjectiveData }>({
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

  return useMutation<UpdateObjectiveResult, Error, { clientId: string; objectiveId: string; data: UpdateObjectiveData }>({
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

  return useMutation<DeleteObjectiveResult, Error, { clientId: string; objectiveId: string }>({
    mutationFn: ({ clientId, objectiveId }) =>
      clientSuccessApi.deleteObjective(clientId, objectiveId),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientSuccess", clientId] });
      toast.success(t("clientSuccess.objectiveDeleted"));
    },
  });
}

type AddMetricData = Parameters<typeof clientSuccessApi.addMetric>[1];
type UpdateMetricData = Parameters<typeof clientSuccessApi.updateMetric>[2];
type AddMetricResult = Awaited<ReturnType<typeof clientSuccessApi.addMetric>>;
type UpdateMetricResult = Awaited<ReturnType<typeof clientSuccessApi.updateMetric>>;
type DeleteMetricResult = Awaited<ReturnType<typeof clientSuccessApi.deleteMetric>>;

export function useAddSuccessMetric() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<AddMetricResult, Error, { clientId: string; data: AddMetricData }>({
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

  return useMutation<UpdateMetricResult, Error, { clientId: string; metricId: string; data: UpdateMetricData }>({
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

  return useMutation<DeleteMetricResult, Error, { clientId: string; metricId: string }>({
    mutationFn: ({ clientId, metricId }) =>
      clientSuccessApi.deleteMetric(clientId, metricId),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientSuccess", clientId] });
      toast.success(t("clientSuccess.metricDeleted"));
    },
  });
}

type AddRecommendationData = Parameters<typeof clientSuccessApi.addRecommendation>[1];
type UpdateRecommendationData = Parameters<typeof clientSuccessApi.updateRecommendation>[2];
type AddRecommendationResult = Awaited<ReturnType<typeof clientSuccessApi.addRecommendation>>;
type UpdateRecommendationResult = Awaited<ReturnType<typeof clientSuccessApi.updateRecommendation>>;
type DeleteRecommendationResult = Awaited<ReturnType<typeof clientSuccessApi.deleteRecommendation>>;

export function useAddSuccessRecommendation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<AddRecommendationResult, Error, { clientId: string; data: AddRecommendationData }>({
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

  return useMutation<UpdateRecommendationResult, Error, { clientId: string; recommendationId: string; data: UpdateRecommendationData }>({
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

  return useMutation<DeleteRecommendationResult, Error, { clientId: string; recommendationId: string }>({
    mutationFn: ({ clientId, recommendationId }) =>
      clientSuccessApi.deleteRecommendation(clientId, recommendationId),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientSuccess", clientId] });
      toast.success(t("clientSuccess.recommendationDeleted"));
    },
  });
}

type AddTimelineData = Parameters<typeof clientSuccessApi.addTimeline>[1];
type AddTimelineResult = Awaited<ReturnType<typeof clientSuccessApi.addTimeline>>;
type DeleteTimelineResult = Awaited<ReturnType<typeof clientSuccessApi.deleteTimeline>>;

export function useAddSuccessTimeline() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<AddTimelineResult, Error, { clientId: string; data: AddTimelineData }>({
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

  return useMutation<DeleteTimelineResult, Error, { clientId: string; timelineId: string }>({
    mutationFn: ({ clientId, timelineId }) =>
      clientSuccessApi.deleteTimeline(clientId, timelineId),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientSuccess", clientId] });
      toast.success(t("clientSuccess.timelineDeleted"));
    },
  });
}
