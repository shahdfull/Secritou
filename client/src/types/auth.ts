export interface User {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "CLIENT" | "FREELANCER";
  companyId?: string;
  clientId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
  companyName: string;
}

export interface ApiResponse<T> {
  data: T;
}
