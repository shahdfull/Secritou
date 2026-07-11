import { useQuery } from "@tanstack/react-query";
import { healthBoardApi } from "@/api/healthBoard.api";
import { queryKeys } from "@/lib/query-keys";

export function useHealthBoard(serviceId?: string) {
  return useQuery({
    queryKey: [...queryKeys.healthBoard(), serviceId],
    queryFn: () => healthBoardApi.getHealthBoard(serviceId),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}
