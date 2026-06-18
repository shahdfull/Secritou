import apiClient from "./axios";
import type { ApiResponse } from "../types/auth";
import type {
  FreelancerRating,
  FreelancerRatingsResult,
  RatingStats,
  CreateRatingInput,
  UpdateRatingInput,
} from "../types/rating";

export const ratingsApi = {
  getFreelancerRatings: async (
    freelancerId: string,
    params: { page?: number; pageSize?: number } = {}
  ): Promise<FreelancerRatingsResult> => {
    const response = await apiClient.get<ApiResponse<FreelancerRatingsResult>>(
      `/ratings/freelancers/${freelancerId}`,
      { params }
    );
    return response.data.data;
  },

  getFreelancerStats: async (freelancerId: string): Promise<RatingStats> => {
    const response = await apiClient.get<ApiResponse<RatingStats>>(
      `/ratings/freelancers/${freelancerId}/stats`
    );
    return response.data.data;
  },

  create: async (data: CreateRatingInput): Promise<FreelancerRating> => {
    const response = await apiClient.post<ApiResponse<FreelancerRating>>("/ratings", data);
    return response.data.data;
  },

  update: async (id: string, data: UpdateRatingInput): Promise<FreelancerRating> => {
    const response = await apiClient.patch<ApiResponse<FreelancerRating>>(`/ratings/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/ratings/${id}`);
  },
};
