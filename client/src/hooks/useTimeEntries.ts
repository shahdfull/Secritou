import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { timeEntryApi, type CreateTimeEntryInput } from "@/api/timeEntry.api";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
import { getServerErrorMessage } from "@/utils/apiError";

export function useTimeEntries(projectId: string, page = 1) {
  return useQuery({
    queryKey: queryKeys.projectTimeEntries(projectId, { page }),
    queryFn: () => timeEntryApi.list(projectId, page),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

export function useTimeSummary(projectId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.projectTimeSummary(projectId),
    queryFn: () => timeEntryApi.getSummary(projectId),
    enabled: enabled && !!projectId,
    staleTime: 60_000,
  });
}

export function useMyTimeSummary(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["myTimeSummary", projectId],
    queryFn: () => timeEntryApi.getMySummary(projectId),
    enabled: enabled && !!projectId,
    staleTime: 60_000,
  });
}

export function useCreateTimeEntry(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTimeEntryInput) => timeEntryApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectTimeEntries(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectTimeSummary(projectId) });
      queryClient.invalidateQueries({ queryKey: ["myTimeSummary", projectId] });
      toast.success("Temps enregistré");
    },
    // SEC-095: prefer the server's actual message (e.g. 409 PROJECT_ARCHIVED) over err.message,
    // an opaque Axios status line ("Request failed with status code 409").
    onError: (err) => {
      toast.error(getServerErrorMessage(err) || "Erreur lors de l'enregistrement");
    },
  });
}
