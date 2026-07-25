// GDPR export/erasure API client — see server/src/routes/gdpr.routes.ts (RG-025).
import apiClient from "./axios";

export interface GdprEraseResult {
  mode: "deleted" | "anonymized";
}

export const gdprApi = {
  exportClient: async (id: string): Promise<unknown> => {
    const response = await apiClient.get<{ data: unknown }>(`/gdpr/clients/${id}/export`);
    return response.data.data;
  },

  eraseClient: async (id: string): Promise<GdprEraseResult> => {
    const response = await apiClient.post<{ data: GdprEraseResult }>(`/gdpr/clients/${id}/erase`);
    return response.data.data;
  },

  exportUser: async (id: string): Promise<unknown> => {
    const response = await apiClient.get<{ data: unknown }>(`/gdpr/users/${id}/export`);
    return response.data.data;
  },

  eraseUser: async (id: string): Promise<GdprEraseResult> => {
    const response = await apiClient.post<{ data: GdprEraseResult }>(`/gdpr/users/${id}/erase`);
    return response.data.data;
  },
};
