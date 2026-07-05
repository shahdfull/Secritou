import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../api/analytics.api";
import type { ExecutiveMetrics } from "../types/executiveMetrics";
import { useAuthStore } from "../store/auth.store";

export function useExecutiveMetrics() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";

  return useQuery<ExecutiveMetrics>({
    queryKey: ["analytics", "executive"],
    queryFn: () => analyticsApi.getExecutiveMetrics(),
    staleTime: 1000 * 60 * 3,   // 3 min — matches backend cache TTL
    refetchInterval: 1000 * 60 * 5, // passive refresh every 5 min
    enabled: isAdmin,
  });
}
