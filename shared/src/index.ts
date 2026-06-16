export const roles = ["OWNER", "ADMIN", "MANAGER", "MEMBER", "VIEWER"] as const;
export type Role = (typeof roles)[number];

export type ApiResponse<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string | null;
};
