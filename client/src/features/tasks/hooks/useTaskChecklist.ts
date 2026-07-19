import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taskChecklistApi, type TaskChecklistItem } from "@/api/taskChecklist.api";

export function useTaskChecklist(taskId: string, enabled = true) {
  return useQuery<TaskChecklistItem[]>({
    queryKey: ["taskChecklist", taskId],
    queryFn: () => taskChecklistApi.getByTaskId(taskId),
    enabled: enabled && !!taskId,
    staleTime: 30_000,
  });
}

export function useCreateChecklistItem(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => taskChecklistApi.create(taskId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taskChecklist", taskId] });
    },
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
  });
}

export function useDeleteChecklistItem(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => taskChecklistApi.delete(taskId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taskChecklist", taskId] });
    },
  });
}
