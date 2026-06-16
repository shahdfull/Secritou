import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { missionsApi } from "../api/missions.api";
import type {
  FreelancerMission,
  CreateMissionInput,
  UpdateMissionInput,
} from "../types/freelancer";
import { toast } from "sonner";

export function useMissions() {
  return useQuery<FreelancerMission[]>({
    queryKey: ["missions"],
    queryFn: () => missionsApi.getAll(),
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
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      toast.success("Mission créée");
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      toast.success("Mission mise à jour");
    },
  });
}

export function useApplyToMission() {
  const queryClient = useQueryClient();

  return useMutation<
    FreelancerMission,
    Error,
    string
  >({
    mutationFn: (id) => missionsApi.apply(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      toast.success("Candidature envoyée");
    },
  });
}

export function useDeleteMission() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => missionsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      toast.success("Mission supprimée");
    },
  });
}
