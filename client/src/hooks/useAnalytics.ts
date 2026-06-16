import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../api/analytics.api";
import type { AnalyticsSummary } from "../types/analyticsData";

export function useAnalyticsSummary() {
  return useQuery<AnalyticsSummary>({
    queryKey: ["analytics", "summary"],
    queryFn: () => analyticsApi.getSummary(),
    staleTime: 1000 * 60 * 5, // cache 5 minutes
  });
}
