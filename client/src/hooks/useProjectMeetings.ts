import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectMeetingsApi, type MeetingFrequency } from "@/api/projectMeetings.api";
import { toast } from "sonner";

export function useProjectMeetings(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["projectMeetings", projectId],
    queryFn: () => projectMeetingsApi.list(projectId),
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
