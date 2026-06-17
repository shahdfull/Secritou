export const roles = ["ADMIN", "MANAGER", "CLIENT", "FREELANCER"] as const;
export type Role = (typeof roles)[number];

export type ApiResponse<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

export type AuthTokens = {
  accessToken: string;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string | null;
  clientId: string | null;
};

export type ListQueryParams = {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "asc" | "desc";
  search?: string;
  status?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type DashboardSummary = {
  totalLeads: number;
  activeClients: number;
  ongoingProjects: number;
  completedTasks: number;
};
