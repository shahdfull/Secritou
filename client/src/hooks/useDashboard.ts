import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard.api";

// Replaces useApprovals({ status: "PENDING", pageSize: 1 })
//          + useInvoices({ status: "OVERDUE", pageSize: 1 })
//          + useLeads({ status: "QUALIFIED", pageSize: 1 })
// Single request, 2-min stale time (alert counts don't need real-time precision)
export function useDashboardFull() {
  return useQuery({
    queryKey: ["dashboard", "full"],
    queryFn: () => dashboardApi.getFull(),
    staleTime: 2 * 60_000,
  });
}
