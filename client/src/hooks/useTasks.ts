import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "../api/tasks.api";
import type { Task, CreateTaskInput, UpdateTaskInput } from "../types/task";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";
import { toast } from "sonner";
import i18n from "@/i18n";

export function useTasks(params: ListQueryParams = {}, projectId?: string) {
  return useQuery<PaginatedResponse<Task>>({
    queryKey: ["tasks", params, projectId],
    queryFn: () => tasksApi.getAll(params, projectId),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  });
}

export function useTask(id: string) {
  return useQuery<Task>({
    queryKey: ["task", id],
    queryFn: () => tasksApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, CreateTaskInput>({
    mutationFn: (data) => tasksApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(i18n.t("toasts.taskCreated"));
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, { id: string; data: Omit<UpdateTaskInput, "id"> }>({
    mutationFn: ({ id, data }) => tasksApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", data.id] });
      toast.success(i18n.t("toasts.taskUpdated"));
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => tasksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(i18n.t("toasts.taskDeleted"));
    },
  });
}
