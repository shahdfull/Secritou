import apiClient from "./axios";
import type { ServiceRequest, CreateServiceRequestInput } from "../types/serviceRequest";
import type { ApiResponse } from "../types/auth";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";

export const serviceRequestsApi = {
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
    const response = await apiClient.post<ApiResponse<ServiceRequest>>("/service-requests/client", data);
    return response.data.data;
  },
};
