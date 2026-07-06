import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  freelancerApplicationsApi,
  authApi,
  type FreelancerApplication,
  type PaginatedResponse,
} from "../api/freelancerApplications.api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

// Maps a failed application submission's HTTP status to a translated toast message.
function applicationSubmitErrorMessage(error: AxiosError, t: (key: string) => string): string {
  const status = error.response?.status;
  if (status === 413) return t("joinUs.fileTooLarge");
  if (status === 415) return t("joinUs.invalidFileType");
  return t("joinUs.submitError");
}

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
  return useMutation<FreelancerApplication, AxiosError, FormData>({
    mutationFn: (formData) => freelancerApplicationsApi.createApplication(formData),
    onSuccess: () => {
      toast.success(t("joinUs.success"));
    },
    onError: (error) => {
      toast.error(applicationSubmitErrorMessage(error, t));
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
