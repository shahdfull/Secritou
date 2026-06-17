import apiClient from "./axios";
import type {
  FreelancerMission,
  CreateMissionInput,
  UpdateMissionInput,
  MissionApplication,
} from "../types/freelancer";
import type { ApiResponse } from "../types/auth";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";

export const missionsApi = {
  getAll: async (params: ListQueryParams = {}): Promise<PaginatedResponse<FreelancerMission>> => {
    const response = await apiClient.get<PaginatedResponse<FreelancerMission>>(
      "/freelancers/missions",
      { params }
    );
    return response.data;
  },

  getApplications: async (missionId: string): Promise<MissionApplication[]> => {
    const response = await apiClient.get<ApiResponse<MissionApplication[]>>(
      `/freelancers/missions/${missionId}/applications`
    );
    return response.data.data;
  },

  updateApplicationStatus: async (
    missionId: string,
    applicationId: string,
    status: "PENDING" | "ACCEPTED" | "REJECTED"
  ): Promise<MissionApplication> => {
    const response = await apiClient.patch<ApiResponse<MissionApplication>>(
      `/freelancers/missions/${missionId}/applications/${applicationId}`,
      { status }
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

  apply: async (id: string): Promise<MissionApplication> => {
    const response = await apiClient.post<ApiResponse<MissionApplication>>(
      `/freelancers/missions/${id}/apply`
    );
    return response.data.data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/freelancers/missions/${id}`);
  },
};
