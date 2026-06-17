import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { serviceRequestsApi } from "../api/serviceRequests.api";
import type { ServiceRequest, CreateServiceRequestInput } from "../types/serviceRequest";
import { toast } from "sonner";

export function useClientServiceRequests() {
  return useQuery({
    queryKey: ["client-service-requests"],
    queryFn: () => serviceRequestsApi.getClientRequests(),
    select: (result) => result.data,
  });
}

export function useCreateClientServiceRequest() {
  const queryClient = useQueryClient();

  return useMutation<ServiceRequest, Error, CreateServiceRequestInput>({
    mutationFn: (data) => serviceRequestsApi.createClientRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-service-requests"] });
      toast.success("Demande de service créée avec succès !");
    },
  });
}
