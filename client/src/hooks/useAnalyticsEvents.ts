import { useQuery } from "@tanstack/react-query";
import { analyticsEventApi } from "@/api/analyticsEvent.api";
import { queryKeys } from "@/lib/query-keys";

export function useAnalyticsEventSummary(from?: string, to?: string) {
  return useQuery({
    queryKey: queryKeys.analyticsEventSummary({ from, to }),
    queryFn: () => analyticsEventApi.getSummary(from, to),
    staleTime: 5 * 60_000,
  });
}
