import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ratingsApi } from "@/api/ratings.api";
import { queryKeys } from "@/lib/query-keys";
import type { CreateRatingInput, UpdateRatingInput } from "@/types/rating";

export function useFreelancerRatings(
  freelancerId: string,
  params: { page?: number; pageSize?: number } = {}
) {
  return useQuery({
    queryKey: queryKeys.freelancerRatings(freelancerId, params),
    queryFn: () => ratingsApi.getFreelancerRatings(freelancerId, params),
    enabled: !!freelancerId,
  });
}

export function useFreelancerRatingStats(freelancerId: string) {
  return useQuery({
    queryKey: queryKeys.freelancerRatingStats(freelancerId),
    queryFn: () => ratingsApi.getFreelancerStats(freelancerId),
    enabled: !!freelancerId,
  });
}

export function useCreateRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRatingInput) => ratingsApi.create(data),
    onSuccess: (rating) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.freelancerRatings(rating.freelancerId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.freelancerRatingStats(rating.freelancerId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.freelancer(rating.freelancerId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.freelancers() });
    },
  });
}

export function useUpdateRating(freelancerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRatingInput }) =>
      ratingsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.freelancerRatings(freelancerId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.freelancerRatingStats(freelancerId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.freelancer(freelancerId),
      });
    },
  });
}

export function useDeleteRating(freelancerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ratingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.freelancerRatings(freelancerId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.freelancerRatingStats(freelancerId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.freelancer(freelancerId),
      });
    },
  });
}
