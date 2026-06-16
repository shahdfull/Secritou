import apiClient from "./axios";
import type { ServiceRequest, CreateServiceRequestInput } from "../types/serviceRequest";
import type { ApiResponse } from "../types/auth";

export const serviceRequestsApi = {
  getClientRequests: async (): Promise<ServiceRequest[]> => {
    const response = await apiClient.get<ApiResponse<ServiceRequest[]>>("/service-requests/client");
    return response.data.data;
  },

  createClientRequest: async (data: CreateServiceRequestInput): Promise<ServiceRequest> => {
    const response = await apiClient.post<ApiResponse<ServiceRequest>>("/service-requests/client", data);
    return response.data.data;
  },
};
