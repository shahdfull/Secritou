import { useQuery } from "@tanstack/react-query";
import { workloadApi } from "@/api/workload.api";
import { queryKeys } from "@/lib/query-keys";

export function useWorkload(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: queryKeys.workload(params),
    queryFn: () => workloadApi.getWorkload(params),
    staleTime: 5 * 60_000,
  });
}
