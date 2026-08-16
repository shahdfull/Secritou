import { useQuery } from "@tanstack/react-query";
import { auditLogApi } from "@/api/auditLog.api";

export function useAuditLog(params: {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "asc" | "desc";
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
}) {
  return useQuery({
    queryKey: ["audit-log", params],
    queryFn: () => auditLogApi.getAuditLog(params),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });
}

export function useAuditLogEntityTypes() {
  return useQuery({
    queryKey: ["audit-log-entity-types"],
    queryFn: () => auditLogApi.getEntityTypes(),
    staleTime: 5 * 60_000,
  });
}
