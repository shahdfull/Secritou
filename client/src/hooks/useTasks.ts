import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi, type TaskListFilters, type BulkActionResult } from "../api/tasks.api";
import type { Task, CreateTaskInput, UpdateTaskInput, TaskStatus } from "../types/task";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";
import { toast } from "sonner";
import i18n from "@/i18n";
import { queryKeys } from "@/lib/query-keys";

export function useTasks(params: ListQueryParams = {}, projectId?: string, taskFilters?: TaskListFilters) {
  return useQuery<PaginatedResponse<Task>>({
    queryKey: queryKeys.tasks({ ...params, projectId, ...taskFilters }),
    queryFn: () => tasksApi.getAll(params, projectId, taskFilters),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  });
}

export function useTask(id: string) {
  return useQuery<Task>({
    queryKey: queryKeys.task(id),
    queryFn: () => tasksApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, CreateTaskInput>({
    mutationFn: (data) => tasksApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
      toast.success(i18n.t("toasts.taskCreated"));
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, { id: string; data: Omit<UpdateTaskInput, "id"> }>({
    mutationFn: ({ id, data }) => tasksApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: queryKeys.task(data.id) });
      toast.success(i18n.t("toasts.taskUpdated"));
    },
  });
}

export function useCheckFreelancerAvailability() {
  return useMutation({
    mutationFn: (params: { freelancerId: string; startDate: string; endDate: string; excludeTaskId?: string }) =>
      tasksApi.getFreelancerAvailability(params),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => tasksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
      toast.success(i18n.t("toasts.taskDeleted"));
    },
  });
}

// SEC-060 (actions en masse) : le résultat n'est pas un simple succès/échec global — chaque tâche
// du lot est traitée individuellement côté serveur (task.service.ts#bulkUpdateStatus/.bulkDelete),
// donc la mutation renvoie le détail par id ; l'appelant (TasksListView) décide comment présenter
// un résultat partiel (ex. certaines tâches en échec de transition).
export function useBulkUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation<BulkActionResult[], Error, { taskIds: string[]; status: TaskStatus }>({
    mutationFn: ({ taskIds, status }) => tasksApi.bulkUpdateStatus(taskIds, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
    },
  });
}

export function useBulkDeleteTasks() {
  const queryClient = useQueryClient();

  return useMutation<BulkActionResult[], Error, string[]>({
    mutationFn: (taskIds) => tasksApi.bulkDelete(taskIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
    },
  });
}
