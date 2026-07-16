import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { freelancersApi } from "../api/freelancers.api";
import type {
  FreelancerProfile,
  CreateFreelancerProfileInput,
  UpdateFreelancerProfileInput,
} from "../types/freelancer";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import i18n from "@/i18n";

export function useFreelancers(params: ListQueryParams = {}) {
  return useQuery<PaginatedResponse<FreelancerProfile>>({
    queryKey: queryKeys.freelancers(params),
    queryFn: () => freelancersApi.getAll(params),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}

export function useFreelancer(id: string) {
  return useQuery<FreelancerProfile>({
    queryKey: queryKeys.freelancer(id),
    queryFn: () => freelancersApi.getById(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}

// Dedicated lookup for "does the current user have a freelancer profile" —
// deriving this from a paginated/filtered list (freelancers.find(...)) breaks
// as soon as the profile isn't on the current page (search, pagination),
// wrongly showing the "apply" CTA to someone who already applied.
export function useMyFreelancerProfile(enabled: boolean) {
  return useQuery<FreelancerProfile | null>({
    queryKey: queryKeys.myFreelancerProfile(),
    queryFn: () => freelancersApi.getMyProfile(),
    enabled,
    staleTime: 60_000,
  });
}

export function useCreateMyFreelancerProfile() {
  const queryClient = useQueryClient();

  return useMutation<
    FreelancerProfile,
    Error,
    CreateFreelancerProfileInput
  >({
    mutationFn: (data) => freelancersApi.createMyProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.freelancers() });
      queryClient.invalidateQueries({ queryKey: queryKeys.myFreelancerProfile() });
      toast.success(i18n.t("toasts.freelancerProfileCreated"));
    },
  });
}

export function useUpdateMyFreelancerProfile() {
  const queryClient = useQueryClient();

  return useMutation<
    FreelancerProfile,
    Error,
    UpdateFreelancerProfileInput
  >({
    mutationFn: (data) => freelancersApi.updateMyProfile(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.freelancers() });
      queryClient.invalidateQueries({ queryKey: queryKeys.freelancer(data.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myFreelancerProfile() });
      toast.success(i18n.t("toasts.freelancerProfileUpdated"));
    },
  });
}

export function useDeleteMyFreelancerProfile() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: () => freelancersApi.deleteMyProfile(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.freelancers() });
      queryClient.invalidateQueries({ queryKey: queryKeys.myFreelancerProfile() });
      toast.success(i18n.t("toasts.freelancerProfileDeleted"));
    },
  });
}
