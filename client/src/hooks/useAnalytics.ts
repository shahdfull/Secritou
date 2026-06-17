import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../api/analytics.api";
import type { AnalyticsSummary } from "../types/analyticsData";

export function useAnalyticsSummary(from?: Date, to?: Date) {
  return useQuery<AnalyticsSummary>({
    queryKey: ["analytics", "summary", from?.toISOString(), to?.toISOString()],
    queryFn: () => analyticsApi.getSummary(from, to),
    staleTime: 1000 * 60 * 5, // cache 5 minutes
  });
}
