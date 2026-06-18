import apiClient from "./axios";
import type {
  ServiceRequest,
  ServiceRequestDetail,
  ServiceRequestComment,
  CreateServiceRequestInput,
  AdminUpdateServiceRequestInput,
  AddCommentInput,
  AdminListServiceRequestsParams,
} from "../types/serviceRequest";
import type { ApiResponse } from "../types/auth";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";

export const serviceRequestsApi = {
  // ── Client ──────────────────────────────────────────────────────────────────

  getClientRequests: async (
    params: ListQueryParams = { page: 1, pageSize: 100 }
  ): Promise<PaginatedResponse<ServiceRequest>> => {
    const response = await apiClient.get<PaginatedResponse<ServiceRequest>>(
      "/service-requests/client",
      { params }
    );
    return response.data;
  },

  createClientRequest: async (data: CreateServiceRequestInput): Promise<ServiceRequest> => {
    const response = await apiClient.post<ApiResponse<ServiceRequest>>(
      "/service-requests/client",
      data
    );
    return response.data.data;
  },

  // ── Admin / Manager ─────────────────────────────────────────────────────────

  adminGetAll: async (
    params: AdminListServiceRequestsParams = {}
  ): Promise<PaginatedResponse<ServiceRequest>> => {
    const response = await apiClient.get<PaginatedResponse<ServiceRequest>>(
      "/service-requests/admin",
      { params }
    );
    return response.data;
  },

  adminGetById: async (id: string): Promise<ServiceRequestDetail> => {
    const response = await apiClient.get<ApiResponse<ServiceRequestDetail>>(
      `/service-requests/admin/${id}`
    );
    return response.data.data;
  },

  adminUpdate: async (
    id: string,
    data: AdminUpdateServiceRequestInput
  ): Promise<ServiceRequestDetail> => {
    const response = await apiClient.patch<ApiResponse<ServiceRequestDetail>>(
      `/service-requests/admin/${id}`,
      data
    );
    return response.data.data;
  },

  adminDelete: async (id: string): Promise<void> => {
    await apiClient.delete(`/service-requests/admin/${id}`);
  },

  addComment: async (
    id: string,
    data: AddCommentInput
  ): Promise<ServiceRequestComment> => {
    const response = await apiClient.post<ApiResponse<ServiceRequestComment>>(
      `/service-requests/admin/${id}/comments`,
      data
    );
    return response.data.data;
  },

  deleteComment: async (id: string, commentId: string): Promise<void> => {
    await apiClient.delete(`/service-requests/admin/${id}/comments/${commentId}`);
  },
};
