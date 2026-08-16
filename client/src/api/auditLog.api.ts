import apiClient from "./axios";

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const auditLogApi = {
  getAuditLog: async (params?: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: "asc" | "desc";
    entityType?: string;
    entityId?: string;
    actorId?: string;
    action?: string;
  }) => {
    const response = await apiClient.get<{ data: PaginatedResponse<AuditLogEntry> }>(
      "/audit-log",
      { params }
    );
    return response.data.data;
  },

  getEntityTypes: async () => {
    const response = await apiClient.get<{ data: string[] }>("/audit-log/entity-types");
    return response.data.data;
  },
};
