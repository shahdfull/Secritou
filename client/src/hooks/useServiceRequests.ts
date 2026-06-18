import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { serviceRequestsApi } from "../api/serviceRequests.api";
import type {
  ServiceRequest,
  ServiceRequestDetail,
  CreateServiceRequestInput,
  AdminUpdateServiceRequestInput,
  AddCommentInput,
  AdminListServiceRequestsParams,
} from "../types/serviceRequest";
import { queryKeys } from "../lib/query-keys";
import { queryInvalidations } from "../lib/query-invalidations";
import { toast } from "sonner";

// ── Client hooks ──────────────────────────────────────────────────────────────

export function useClientServiceRequests() {
  return useQuery({
    queryKey: queryKeys.clientServiceRequests(),
    queryFn: () => serviceRequestsApi.getClientRequests(),
    select: (result) => result.data,
  });
}

export function useCreateClientServiceRequest() {
  const queryClient = useQueryClient();

  return useMutation<ServiceRequest, Error, CreateServiceRequestInput>({
    mutationFn: (data) => serviceRequestsApi.createClientRequest(data),
    onSuccess: () => {
      queryInvalidations.invalidateClientServiceRequests(queryClient);
      toast.success("Demande de service créée avec succès !");
    },
  });
}

// ── Admin / Manager hooks ─────────────────────────────────────────────────────

export function useAdminServiceRequests(params: AdminListServiceRequestsParams = {}) {
  return useQuery({
    queryKey: queryKeys.adminServiceRequests(params),
    queryFn: () => serviceRequestsApi.adminGetAll(params),
    placeholderData: (prev) => prev,
  });
}

export function useAdminServiceRequest(id: string) {
  return useQuery({
    queryKey: queryKeys.adminServiceRequest(id),
    queryFn: () => serviceRequestsApi.adminGetById(id),
    enabled: !!id,
  });
}

export function useAdminUpdateServiceRequest(id: string) {
  const queryClient = useQueryClient();

  return useMutation<ServiceRequestDetail, Error, AdminUpdateServiceRequestInput>({
    mutationFn: (data) => serviceRequestsApi.adminUpdate(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.adminServiceRequest(id), updated);
      queryInvalidations.invalidateAdminServiceRequests(queryClient);
      toast.success("Demande mise à jour");
    },
    onError: (error) => {
      toast.error(error.message ?? "Une erreur est survenue");
    },
  });
}

export function useAdminDeleteServiceRequest() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => serviceRequestsApi.adminDelete(id),
    onSuccess: () => {
      queryInvalidations.invalidateAdminServiceRequests(queryClient);
      toast.success("Demande supprimée");
    },
    onError: (error) => {
      toast.error(error.message ?? "Une erreur est survenue");
    },
  });
}

export function useAddComment(serviceRequestId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    Awaited<ReturnType<typeof serviceRequestsApi.addComment>>,
    Error,
    AddCommentInput
  >({
    mutationFn: (data) => serviceRequestsApi.addComment(serviceRequestId, data),
    onSuccess: () => {
      queryInvalidations.invalidateAdminServiceRequest(queryClient, serviceRequestId);
      toast.success("Commentaire ajouté");
    },
    onError: (error) => {
      toast.error(error.message ?? "Une erreur est survenue");
    },
  });
}

export function useDeleteComment(serviceRequestId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (commentId) => serviceRequestsApi.deleteComment(serviceRequestId, commentId),
    onSuccess: () => {
      queryInvalidations.invalidateAdminServiceRequest(queryClient, serviceRequestId);
      toast.success("Commentaire supprimé");
    },
  });
}
