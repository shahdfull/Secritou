import { useQuery } from "@tanstack/react-query";
import { healthBoardApi } from "@/api/healthBoard.api";
import { queryKeys } from "@/lib/query-keys";

export function useHealthBoard() {
  return useQuery({
    queryKey: queryKeys.healthBoard(),
    queryFn: healthBoardApi.getHealthBoard,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}
