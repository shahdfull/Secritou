import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { timeEntryApi, type CreateTimeEntryInput } from "@/api/timeEntry.api";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";

export function useTimeEntries(projectId: string, page = 1) {
  return useQuery({
    queryKey: queryKeys.projectTimeEntries(projectId, { page }),
    queryFn: () => timeEntryApi.list(projectId, page),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

export function useTimeSummary(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projectTimeSummary(projectId),
    queryFn: () => timeEntryApi.getSummary(projectId),
    enabled: !!projectId,
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
      toast.success("Temps enregistré");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erreur lors de l'enregistrement");
    },
  });
}
