import apiClient from "./axios";
import type {
  FreelancerProfile,
  CreateFreelancerProfileInput,
  UpdateFreelancerProfileInput,
} from "../types/freelancer";
import type { ApiResponse } from "../types/auth";

export const freelancersApi = {
  getAll: async (): Promise<FreelancerProfile[]> => {
    const response = await apiClient.get<ApiResponse<FreelancerProfile[]>>(
      "/freelancers"
    );
    return response.data.data;
  },

  getById: async (id: string): Promise<FreelancerProfile> => {
    const response = await apiClient.get<ApiResponse<FreelancerProfile>>(
      `/freelancers/${id}`
    );
    return response.data.data;
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
