import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  freelancerApplicationsApi,
  authApi,
  type FreelancerApplication,
  type PaginatedResponse,
} from "../api/freelancerApplications.api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function useFreelancerApplications(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}) {
  return useQuery<PaginatedResponse<FreelancerApplication>>({
    queryKey: ["freelancerApplications", params],
    queryFn: () => freelancerApplicationsApi.getApplications(params),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}

export function useFreelancerApplication(id: string) {
  return useQuery<FreelancerApplication>({
    queryKey: ["freelancerApplication", id],
    queryFn: () => freelancerApplicationsApi.getApplicationById(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCreateFreelancerApplication() {
  const { t } = useTranslation();
  return useMutation<
    FreelancerApplication,
    Error,
    {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      position: string;
      cvUrl: string;
      portfolioUrl: string;
    }
  >({
    mutationFn: (data) => freelancerApplicationsApi.createApplication(data),
    onSuccess: () => {
      toast.success(t("joinUs.success"));
    },
  });
}

export function useRejectFreelancerApplication() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<
    FreelancerApplication,
    Error,
    { id: string; rejectionReason?: string }
  >({
    mutationFn: ({ id, rejectionReason }) =>
      freelancerApplicationsApi.rejectApplication(id, rejectionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancerApplications"] });
      toast.success(t("applications.rejected"));
    },
  });
}

export function useAcceptFreelancerApplication() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<
    { user: any; application: FreelancerApplication },
    Error,
    {
      id: string;
      username: string;
      password: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      role: "FREELANCER" | "MANAGER";
    }
  >({
    mutationFn: ({ id, ...data }) =>
      freelancerApplicationsApi.acceptApplication(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancerApplications"] });
      toast.success(t("applications.accepted"));
    },
  });
}

export function usePendingApplications() {
  return useQuery<FreelancerApplication[]>({
    queryKey: ["freelancerApplications", "pending"],
    queryFn: () => freelancerApplicationsApi.getPendingApplications(),
    staleTime: 60_000,
  });
}

export function useAssignApplication() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<FreelancerApplication, Error, string>({
    mutationFn: (id) => freelancerApplicationsApi.assignApplication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancerApplications"] });
      toast.success(t("applications.assigned", "Candidature assignée à votre entreprise"));
    },
  });
}

export function useChangePassword() {
  const { t } = useTranslation();
  return useMutation<
    any,
    Error,
    { currentPassword: string; newPassword: string }
  >({
    mutationFn: (data) => authApi.changePassword(data),
    onSuccess: () => {
      toast.success(t("auth.passwordChanged"));
    },
  });
}
