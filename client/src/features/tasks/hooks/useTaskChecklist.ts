import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taskChecklistApi, type TaskChecklistItem } from "@/api/taskChecklist.api";
import { toast } from "sonner";
import { getServerErrorMessage } from "@/utils/apiError";

export function useTaskChecklist(taskId: string, enabled = true) {
  return useQuery<TaskChecklistItem[]>({
    queryKey: ["taskChecklist", taskId],
    queryFn: () => taskChecklistApi.getByTaskId(taskId),
    enabled: enabled && !!taskId,
    staleTime: 30_000,
  });
}

// SEC-095: none of the three mutations below had an onError at all — a rejection (e.g. 409
// PROJECT_ARCHIVED on a task whose project just got archived, or 422 CHECKLIST_LIMIT_REACHED)
// failed completely silently, with nothing shown to the user.
function showChecklistError(fallback: string) {
  return (err: unknown) => {
    toast.error(getServerErrorMessage(err) || fallback);
  };
}

export function useCreateChecklistItem(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => taskChecklistApi.create(taskId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taskChecklist", taskId] });
    },
    onError: showChecklistError("Erreur lors de l'ajout de la sous-tâche"),
  });
}

export function useUpdateChecklistItem(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: { title?: string; done?: boolean } }) =>
      taskChecklistApi.update(taskId, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taskChecklist", taskId] });
    },
    onError: showChecklistError("Erreur lors de la mise à jour de la sous-tâche"),
  });
}

export function useDeleteChecklistItem(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => taskChecklistApi.delete(taskId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taskChecklist", taskId] });
    },
    onError: showChecklistError("Erreur lors de la suppression de la sous-tâche"),
  });
}
