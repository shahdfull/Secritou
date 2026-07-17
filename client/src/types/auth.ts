export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: "ADMIN" | "MANAGER" | "CLIENT" | "FREELANCER";
  clientId?: string;
  serviceId?: string | null;
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
