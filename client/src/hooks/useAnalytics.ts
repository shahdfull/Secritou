import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../api/analytics.api";
import type { AnalyticsSummary } from "../types/analyticsData";
import { usePermission } from "./usePermission";

export function useAnalyticsSummary(from?: Date, to?: Date) {
  const canRead = usePermission("analytics", "read");
  return useQuery<AnalyticsSummary>({
    queryKey: ["analytics", "summary", from?.toISOString(), to?.toISOString()],
    queryFn: () => analyticsApi.getSummary(from, to),
    staleTime: 1000 * 60 * 5,
    enabled: canRead,
  });
}
