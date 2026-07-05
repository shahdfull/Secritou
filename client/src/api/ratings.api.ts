import apiClient from "./axios";

export interface Rating {
  id: string;
  score: number;
  comment?: string;
  freelancerId: string;
  ratedByUserId?: string;
  ratedByUser?: { id: string; name: string };
  createdAt: string;
}

export const ratingsApi = {
  getByFreelancerId: async (freelancerId: string) => {
    const response = await apiClient.get<{ data: Rating[] }>(`/ratings/freelancers/${freelancerId}`);
    return response.data.data;
  },
  add: async (freelancerId: string, data: { score: number; comment?: string }) => {
    const response = await apiClient.post<{ data: Rating }>(`/ratings/freelancers/${freelancerId}`, data);
    return response.data.data;
  },
};
