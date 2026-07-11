import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../api/analytics.api";
import type { ExecutiveMetrics } from "../types/executiveMetrics";
import { useAuthStore } from "../store/auth.store";

export function useExecutiveMetrics(serviceId?: string) {
  const user = useAuthStore((s) => s.user);
  const canView = user?.role === "ADMIN" || user?.role === "MANAGER";

  return useQuery<ExecutiveMetrics>({
    queryKey: ["analytics", "executive", serviceId],
    queryFn: () => analyticsApi.getExecutiveMetrics(serviceId),
    staleTime: 1000 * 60 * 3,   // 3 min — matches backend cache TTL
    refetchInterval: 1000 * 60 * 5, // passive refresh every 5 min
    enabled: canView,
  });
}
