import apiClient from "./axios";
import type { ApiResponse } from "../types/auth";
import type { PermissionProfile, PermissionsMap } from "../types/permissions";

export interface CreateProfileInput {
  name: string;
  description?: string;
  permissions: PermissionsMap;
  isDefault?: boolean;
}

export interface UpdateProfileInput {
  name?: string;
  description?: string;
  permissions?: Partial<PermissionsMap>;
  isDefault?: boolean;
}

export const permissionProfilesApi = {
  getAll: async (): Promise<PermissionProfile[]> => {
    const response = await apiClient.get<ApiResponse<PermissionProfile[]>>("/permission-profiles");
    return response.data.data;
  },

  create: async (data: CreateProfileInput): Promise<PermissionProfile> => {
    const response = await apiClient.post<ApiResponse<PermissionProfile>>("/permission-profiles", data);
    return response.data.data;
  },

  update: async (id: string, data: UpdateProfileInput): Promise<PermissionProfile> => {
    const response = await apiClient.patch<ApiResponse<PermissionProfile>>(`/permission-profiles/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/permission-profiles/${id}`);
  },
};
