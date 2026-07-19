import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectMeetingsApi, type MeetingFrequency } from "@/api/projectMeetings.api";
import { toast } from "sonner";

// SEC-055 (F6): page/pageSize are optional — passing neither preserves the previous unpaginated
// call (queryKey includes them so a page change refetches, and so the unpaginated call keeps its
// own cache entry distinct from a paginated one).
export function useProjectMeetings(projectId: string, enabled = true, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ["projectMeetings", projectId, page, pageSize],
    queryFn: () => projectMeetingsApi.list(projectId, page, pageSize),
    enabled: enabled && !!projectId,
    staleTime: 60_000,
  });
}

export function useCreateProjectMeeting(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { meetingDate: string; participants?: string; notes?: string }) =>
      projectMeetingsApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectMeetings", projectId] });
      toast.success("Point ajouté");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erreur lors de l'ajout");
    },
  });
}

export function useUpdateProjectMeeting(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ meetingId, data }: { meetingId: string; data: { meetingDate?: string; participants?: string; notes?: string } }) =>
      projectMeetingsApi.update(projectId, meetingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectMeetings", projectId] });
      toast.success("Réunion mise à jour");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erreur lors de la mise à jour");
    },
  });
}

export function useDeleteProjectMeeting(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (meetingId: string) => projectMeetingsApi.delete(projectId, meetingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectMeetings", projectId] });
      toast.success("Réunion supprimée");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erreur lors de la suppression");
    },
  });
}

export function useMeetingSchedule(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["meetingSchedule", projectId],
    queryFn: () => projectMeetingsApi.getSchedule(projectId),
    enabled: enabled && !!projectId,
    staleTime: 60_000,
  });
}

export function useSetMeetingSchedule(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { frequency: MeetingFrequency; nextMeetingDate?: string }) =>
      projectMeetingsApi.setSchedule(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetingSchedule", projectId] });
      toast.success("Cadence de réunion mise à jour");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erreur lors de la mise à jour");
    },
  });
}
