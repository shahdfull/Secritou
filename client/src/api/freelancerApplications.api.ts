import apiClient from "./axios";

export interface FreelancerApplication {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position: string;
  cvUrl: string;
  portfolioUrl: string;
  aiSummary?: string | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  rejectionReason?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const freelancerApplicationsApi = {
  // The server expects multipart/form-data: text fields plus cvFile/portfolioFile.
  // See JoinUsPage.tsx for how the FormData is built.
  createApplication: async (formData: FormData) => {
    const response = await apiClient.post<{ data: FreelancerApplication }>(
      "/freelancer-applications",
      formData
    );
    return response.data.data;
  },

  getApplications: async (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
  }) => {
    const response = await apiClient.get<PaginatedResponse<FreelancerApplication>>(
      "/freelancer-applications",
      { params }
    );
    return response.data;
  },

  getApplicationById: async (id: string) => {
    const response = await apiClient.get<{ data: FreelancerApplication }>(
      `/freelancer-applications/${id}`
    );
    return response.data.data;
  },

  rejectApplication: async (id: string, rejectionReason?: string) => {
    const response = await apiClient.post<{ data: FreelancerApplication }>(
      `/freelancer-applications/${id}/reject`,
      { rejectionReason }
    );
    return response.data.data;
  },

  acceptApplication: async (
    id: string,
    data: {
      username: string;
      password: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      role: "FREELANCER" | "MANAGER";
    }
  ) => {
    const response = await apiClient.post<{
      data: { user: any; application: FreelancerApplication };
    }>(`/freelancer-applications/${id}/accept`, data);
    return response.data.data;
  },

  getPendingApplications: async () => {
    const response = await apiClient.get<{ data: FreelancerApplication[] }>(
      "/freelancer-applications/pending"
    );
    return response.data.data;
  },
};

// Auth API additions
export const authApi = {
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const response = await apiClient.post("/auth/change-password", data);
    return response.data;
  },
};
