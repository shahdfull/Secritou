import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { missionsApi } from "../api/missions.api";
import type {
  FreelancerMission,
  CreateMissionInput,
  UpdateMissionInput,
} from "../types/freelancer";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";
import { toast } from "sonner";
import i18n from "@/i18n";
import { queryKeys } from "@/lib/query-keys";

export function useMissions(params: ListQueryParams = {}) {
  return useQuery<PaginatedResponse<FreelancerMission>>({
    queryKey: queryKeys.missions(params),
    queryFn: () => missionsApi.getAll(params),
    placeholderData: (prev) => prev,
  });
}

export function useCreateMission() {
  const queryClient = useQueryClient();

  return useMutation<
    FreelancerMission,
    Error,
    CreateMissionInput
  >({
    mutationFn: (data) => missionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.missions() });
      toast.success(i18n.t("toasts.missionCreated"));
    },
  });
}

export function useUpdateMission() {
  const queryClient = useQueryClient();

  return useMutation<
    FreelancerMission,
    Error,
    { id: string; data: UpdateMissionInput }
  >({
    mutationFn: ({ id, data }) => missionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.missions() });
      toast.success(i18n.t("toasts.missionUpdated"));
    },
  });
}

export function useApplyToMission() {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    Error,
    string
  >({
    mutationFn: (id) => missionsApi.apply(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.missions() });
      toast.success(i18n.t("toasts.missionApplied"));
    },
  });
}

export function useDeleteMission() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => missionsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.missions() });
      toast.success(i18n.t("toasts.missionDeleted"));
    },
  });
}
