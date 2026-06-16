import apiClient from "./axios";
import type {
  User,
  AuthTokens,
  LoginCredentials,
  RegisterCredentials,
  ApiResponse,
} from "../types/auth";

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> => {
    const response = await apiClient.post<ApiResponse<{ user: User; tokens: AuthTokens }>>(
      "/auth/login",
      credentials
    );
    return response.data.data;
  },

  register: async (credentials: RegisterCredentials): Promise<{ user: User; tokens: AuthTokens }> => {
    const response = await apiClient.post<ApiResponse<{ user: User; tokens: AuthTokens }>>(
      "/auth/register",
      credentials
    );
    return response.data.data;
  },

  refresh: async (refreshToken: string): Promise<{ tokens: AuthTokens }> => {
    const response = await apiClient.post<ApiResponse<{ tokens: AuthTokens }>>(
      "/auth/refresh",
      { refreshToken }
    );
    return response.data.data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    await apiClient.post("/auth/logout", { refreshToken });
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<ApiResponse<User>>("/auth/me");
    return response.data.data;
  },
};
