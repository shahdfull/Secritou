export interface User {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "CLIENT" | "FREELANCER";
  clientId?: string;
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
}

export interface ApiResponse<T> {
  data: T;
}
