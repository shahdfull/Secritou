import apiClient from "./axios";
import type { Company, UpdateCompanyInput } from "../types/company";
import type { ApiResponse } from "../types/auth";

export const companyApi = {
  get: async (): Promise<Company> => {
    const response = await apiClient.get<ApiResponse<Company>>("/companies");
    return response.data.data;
  },

  update: async (data: UpdateCompanyInput): Promise<Company> => {
    const response = await apiClient.put<ApiResponse<Company>>("/companies", data);
    return response.data.data;
  },
};
