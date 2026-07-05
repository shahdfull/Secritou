import { useQuery } from "@tanstack/react-query";
import { revenueForecastApi } from "@/api/revenueForecast.api";
import { queryKeys } from "@/lib/query-keys";

export function useRevenueForecast() {
  return useQuery({
    queryKey: queryKeys.revenueForecast(),
    queryFn: revenueForecastApi.getForecast,
    staleTime: 5 * 60_000,
  });
}
