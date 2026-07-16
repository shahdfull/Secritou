import apiClient from "./axios";
import type { User } from "../types/auth";
import type { ApiResponse } from "../types/auth";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";

export interface PermissionsMatrix {
  [key: string]: string[];
}

export interface InviteUserInput {
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "CLIENT" | "FREELANCER";
}

export interface UpdateUserInput {
  name?: string;
  role?: "ADMIN" | "MANAGER" | "CLIENT" | "FREELANCER";
}

export interface UpdateMeInput {
  name?: string;
  email?: string;
  phone?: string | null;
}

export const usersApi = {
  getMe: async (): Promise<User> => {
    const response = await apiClient.get<ApiResponse<User>>("/users/me");
    return response.data.data;
  },

  updateMe: async (data: UpdateMeInput): Promise<User> => {
    const response = await apiClient.patch<ApiResponse<User>>("/users/me", data);
    return response.data.data;
  },


  getUsers: async (params: ListQueryParams = { page: 1, pageSize: 100 }): Promise<PaginatedResponse<User>> => {
    const response = await apiClient.get<PaginatedResponse<User>>("/users", { params });
    return response.data;
  },

  inviteUser: async (data: InviteUserInput): Promise<User> => {
    const response = await apiClient.post<ApiResponse<User>>("/users", data);
    return response.data.data;
  },

  updateUser: async (id: string, data: UpdateUserInput): Promise<User> => {
    const response = await apiClient.patch<ApiResponse<User>>(`/users/${id}`, data);
    return response.data.data;
  },

  deleteUser: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}`);
  },

  getPermissions: async (): Promise<PermissionsMatrix> => {
    const response = await apiClient.get<ApiResponse<PermissionsMatrix>>("/users/permissions");
    return response.data.data;
  },

  sendHeartbeat: async (): Promise<void> => {
    await apiClient.post("/users/me/heartbeat");
  },
};
