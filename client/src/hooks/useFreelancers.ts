import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { freelancersApi } from "../api/freelancers.api";
import type {
  FreelancerProfile,
  CreateFreelancerProfileInput,
  UpdateFreelancerProfileInput,
} from "../types/freelancer";
import { toast } from "sonner";

export function useFreelancers() {
  return useQuery<FreelancerProfile[]>({
    queryKey: ["freelancers"],
    queryFn: () => freelancersApi.getAll(),
  });
}

export function useFreelancer(id: string) {
  return useQuery<FreelancerProfile>({
    queryKey: ["freelancer", id],
    queryFn: () => freelancersApi.getById(id),
    enabled: !!id,
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
      queryClient.invalidateQueries({ queryKey: ["freelancers"] });
      toast.success("Profile created successfully");
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
      queryClient.invalidateQueries({ queryKey: ["freelancers"] });
      queryClient.invalidateQueries({ queryKey: ["freelancer", data.id] });
      toast.success("Profile updated successfully");
    },
  });
}

export function useDeleteMyFreelancerProfile() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: () => freelancersApi.deleteMyProfile(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancers"] });
      toast.success("Profile deleted successfully");
    },
  });
}
