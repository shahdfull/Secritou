import { useQuery } from "@tanstack/react-query";
import { clientProfitabilityApi } from "@/api/clientProfitability.api";
import { queryKeys } from "@/lib/query-keys";

export function useClientProfitability() {
  return useQuery({
    queryKey: queryKeys.clientProfitability(),
    queryFn: clientProfitabilityApi.getProfitability,
    staleTime: 5 * 60_000,
  });
}
