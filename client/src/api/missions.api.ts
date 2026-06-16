import apiClient from "./axios";
import type {
  FreelancerMission,
  CreateMissionInput,
  UpdateMissionInput,
} from "../types/freelancer";
import type { ApiResponse } from "../types/auth";

export const missionsApi = {
  getAll: async (): Promise<FreelancerMission[]> => {
    const response = await apiClient.get<ApiResponse<FreelancerMission[]>>(
      "/freelancers/missions"
    );
    return response.data.data;
  },

  create: async (data: CreateMissionInput): Promise<FreelancerMission> => {
    const response = await apiClient.post<ApiResponse<FreelancerMission>>(
      "/freelancers/missions",
      data
    );
    return response.data.data;
  },

  update: async (
    id: string,
    data: UpdateMissionInput
  ): Promise<FreelancerMission> => {
    const response = await apiClient.put<ApiResponse<FreelancerMission>>(
      `/freelancers/missions/${id}`,
      data
    );
    return response.data.data;
  },

  apply: async (id: string): Promise<FreelancerMission> => {
    const response = await apiClient.post<ApiResponse<FreelancerMission>>(
      `/freelancers/missions/${id}/apply`
    );
    return response.data.data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/freelancers/missions/${id}`);
  },
};
