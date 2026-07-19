import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTasks } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import { usersApi } from "@/api/users.api";
import { commentsApi } from "@/api/comments.api";
import type { TaskListFilters } from "@/api/tasks.api";
import type { User } from "@/types/auth";
import type { Comment } from "@/types/comment";

type ListParams = Parameters<typeof useTasks>[0];

/**
 * Aggregates the four queries TasksPage depends on (tasks, projects, users,
 * comments-for-selected-task) plus the derived lookup maps.
 * `projectId` (SEC-052) narrows the tasks query to a single project — set when TasksPage is
 * reached via a project's "Voir toutes les tâches" link (?projectId=... in the URL).
 * `taskFilters` (SEC-056) adds assignee/overdue narrowing, both persisted in the URL the same
 * way status/search already are via useListParams.
 */
export function useTasksPageData(
  listParams: ListParams,
  selectedTaskId: string | null,
  projectId?: string,
  taskFilters?: TaskListFilters
) {
  const { data: tasksResult, isLoading: tasksLoading } = useTasks(listParams, projectId, taskFilters);
  const { data: projectsResult, isLoading: projectsLoading } = useProjects({ page: 1, pageSize: 100 });

  const tasks = useMemo(() => tasksResult?.data ?? [], [tasksResult?.data]);
  const total = tasksResult?.total ?? 0;
  const projects = useMemo(() => projectsResult?.data ?? [], [projectsResult?.data]);
  const projectsTotal = projectsResult?.total ?? 0;

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["companyUsers"],
    queryFn: async () => {
      const result = await usersApi.getUsers();
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: comments } = useQuery<Comment[]>({
    queryKey: ["taskComments", selectedTaskId],
    queryFn: async () => {
      if (!selectedTaskId) return [];
      return commentsApi.getByTaskId(selectedTaskId);
    },
    enabled: !!selectedTaskId,
    staleTime: 15 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  const userById = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users ?? []) map.set(u.id, u);
    return map;
  }, [users]);

  return {
    tasks,
    total,
    projects,
    projectsTotal,
    users,
    comments,
    projectNameById,
    userById,
    isLoading: tasksLoading || projectsLoading || usersLoading,
  };
}
