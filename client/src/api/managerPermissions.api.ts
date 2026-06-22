import apiClient from "./axios";
import type { ApiResponse } from "../types/auth";
import type { ManagerPermission, PermissionsMap } from "../types/permissions";

export interface UpdateManagerPermissionInput {
  profileId?: string | null;
  overrides?: any;
}

export const managerPermissionsApi = {
  getMyPermissions: async (): Promise<PermissionsMap> => {
    const response = await apiClient.get<ApiResponse<PermissionsMap>>("/manager-permissions/me");
    return response.data.data;
  },

  getByUserId: async (userId: string): Promise<ManagerPermission | null> => {
    const response = await apiClient.get<ApiResponse<ManagerPermission>>(`/manager-permissions/${userId}`);
    return response.data.data;
  },

  update: async (userId: string, data: UpdateManagerPermissionInput): Promise<ManagerPermission> => {
    const response = await apiClient.put<ApiResponse<ManagerPermission>>(`/manager-permissions/${userId}`, data);
    return response.data.data;
  },
};
