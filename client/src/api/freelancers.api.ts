import apiClient from "./axios";
import { AxiosError } from "axios";
import type {
  FreelancerProfile,
  CreateFreelancerProfileInput,
  UpdateFreelancerProfileInput,
} from "../types/freelancer";
import type { ApiResponse } from "../types/auth";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";

export const freelancersApi = {
  getAll: async (params: ListQueryParams = {}): Promise<PaginatedResponse<FreelancerProfile>> => {
    const response = await apiClient.get<PaginatedResponse<FreelancerProfile>>("/freelancers", {
      params,
    });
    return response.data;
  },

  getById: async (id: string): Promise<FreelancerProfile> => {
    const response = await apiClient.get<ApiResponse<FreelancerProfile>>(
      `/freelancers/${id}`
    );
    return response.data.data;
  },

  // Not having a profile yet is a normal state for a FREELANCER user (before
  // they apply), not an error — the endpoint 404s in that case, so translate
  // that specific response into `null` instead of letting it throw.
  getMyProfile: async (): Promise<FreelancerProfile | null> => {
    try {
      const response = await apiClient.get<ApiResponse<FreelancerProfile>>("/freelancers/me");
      return response.data.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404) return null;
      throw error;
    }
  },

  createMyProfile: async (
    data: CreateFreelancerProfileInput
  ): Promise<FreelancerProfile> => {
    const response = await apiClient.post<ApiResponse<FreelancerProfile>>(
      "/freelancers/me",
      data
    );
    return response.data.data;
  },

  updateMyProfile: async (
    data: UpdateFreelancerProfileInput
  ): Promise<FreelancerProfile> => {
    const response = await apiClient.put<ApiResponse<FreelancerProfile>>(
      "/freelancers/me",
      data
    );
    return response.data.data;
  },

  deleteMyProfile: async (): Promise<void> => {
    await apiClient.delete("/freelancers/me");
  },
};
