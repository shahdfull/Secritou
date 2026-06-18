import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "../api/projects.api";
import type { Project, CreateProjectInput, UpdateProjectInput } from "../types/project";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";
import { toast } from "sonner";
import i18n from "@/i18n";
import { queryKeys } from "@/lib/query-keys";

export function useProjects(params: ListQueryParams = {}) {
  return useQuery<PaginatedResponse<Project>>({
    queryKey: queryKeys.projects(params),
    queryFn: () => projectsApi.getAll(params),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
    gcTime: 20 * 60_000,
  });
}

export function useProject(id: string) {
  return useQuery<Project>({
    queryKey: queryKeys.project(id),
    queryFn: () => projectsApi.getById(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation<Project, Error, CreateProjectInput>({
    mutationFn: (data) => projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
      toast.success(i18n.t("toasts.projectCreated"));
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation<Project, Error, { id: string; data: Omit<UpdateProjectInput, "id"> }>({
    mutationFn: ({ id, data }) => projectsApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(data.id) });
      toast.success(i18n.t("toasts.projectUpdated"));
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
      toast.success(i18n.t("toasts.projectDeleted"));
    },
  });
}
