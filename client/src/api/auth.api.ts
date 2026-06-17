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
      credentials,
    );
    return response.data.data;
  },

  register: async (credentials: RegisterCredentials): Promise<{ user: User; tokens: AuthTokens }> => {
    const response = await apiClient.post<ApiResponse<{ user: User; tokens: AuthTokens }>>(
      "/auth/register",
      credentials,
    );
    return response.data.data;
  },

  refresh: async (): Promise<{ tokens: AuthTokens }> => {
    const response = await apiClient.post<ApiResponse<{ tokens: AuthTokens }>>("/auth/refresh", {});
    return response.data.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout", {});
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<ApiResponse<User>>("/auth/me");
    return response.data.data;
  },

  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post("/auth/forgot-password", { email });
  },

  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    await apiClient.post("/auth/reset-password", { token, newPassword });
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiClient.post("/auth/change-password", { currentPassword, newPassword });
  },
};
