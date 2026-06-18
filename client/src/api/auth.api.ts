import api from "./axios";
import type { User, AuthTokens, LoginCredentials, RegisterCredentials, ApiResponse } from "../types/auth";

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> => {
    const response = await api.post<ApiResponse<{ user: User; tokens: AuthTokens }>>(
      "/auth/login",
      credentials,
    );
    return response.data.data;
  },

  register: async (credentials: RegisterCredentials): Promise<{ user: User; tokens: AuthTokens }> => {
    const response = await api.post<ApiResponse<{ user: User; tokens: AuthTokens }>>(
      "/auth/register",
      credentials,
    );
    return response.data.data;
  },

  refresh: async (): Promise<{ user: User; tokens: AuthTokens }> => {
    const response = await api.post<ApiResponse<{ user: User; tokens: AuthTokens }>>("/auth/refresh", {});
    return response.data.data;
  },

  logout: async (): Promise<void> => {
    await api.post("/auth/logout", {});
  },

  getMe: async (): Promise<User> => {
    const response = await api.get<ApiResponse<User>>("/auth/me");
    return response.data.data;
  },

  forgotPassword: async (email: string): Promise<void> => {
    await api.post("/auth/forgot-password", { email });
  },

  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    await api.post("/auth/reset-password", { token, newPassword });
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post("/auth/change-password", { currentPassword, newPassword });
  },
};
