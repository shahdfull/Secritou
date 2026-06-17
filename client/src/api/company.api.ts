import apiClient from "./axios";
import type { Company, UpdateCompanyInput } from "../types/company";
import type { ApiResponse, User } from "../types/auth";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";

export const companyApi = {
  get: async (): Promise<Company> => {
    const response = await apiClient.get<ApiResponse<Company>>("/companies");
    return response.data.data;
  },

  getUsers: async (params: ListQueryParams = { page: 1, pageSize: 100 }): Promise<PaginatedResponse<User>> => {
    const response = await apiClient.get<PaginatedResponse<User>>("/companies/users", { params });
    return response.data;
  },

  update: async (data: UpdateCompanyInput): Promise<Company> => {
    const response = await apiClient.put<ApiResponse<Company>>("/companies", data);
    return response.data.data;
  },
};
