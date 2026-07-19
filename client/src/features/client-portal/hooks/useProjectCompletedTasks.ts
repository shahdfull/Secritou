import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "@/api/projects.api";

// SEC-061: extracted to its own file (not colocated with CompletedTasksList.tsx) to avoid adding
// a 13th case to the documented react-refresh/only-export-components exception (CLAUDE.md,
// SEC-049) — a component file exporting both a component and a hook triggers that rule.
export function useProjectCompletedTasks(projectId: string) {
  return useQuery({
    queryKey: ["project-completed-tasks", projectId],
    queryFn: () => projectsApi.getCompletedTasks(projectId),
    staleTime: 30_000,
  });
}
