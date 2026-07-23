import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "@/api/projects.api";

// SEC-091: replaces N independent useProjectTimeline/useProjectCompletedTasks pairs (2 requests
// per visible project card) with a single batched call for every card on the page. Same polling
// cadence as the old per-card ProjectTimeline poller (120s, widened from 30s under this same
// anomaly in an earlier pass) — now shared across every card instead of one poller per card.
export function usePortalSummaries(projectIds: string[]) {
  return useQuery({
    queryKey: ["client-project-summaries", [...projectIds].sort()],
    queryFn: () => projectsApi.getPortalSummaries(projectIds),
    enabled: projectIds.length > 0,
    refetchInterval: 120_000,
    staleTime: 10_000,
  });
}
