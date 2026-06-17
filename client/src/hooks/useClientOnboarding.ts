import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clientOnboardingApi,
  type ClientOnboarding,
} from "../api/clientOnboarding.api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function useClientOnboardings(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}) {
  return useQuery({
    queryKey: ["clientOnboardings", params],
    queryFn: () => clientOnboardingApi.getOnboardings(params),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}

export function useClientOnboarding(id: string) {
  return useQuery({
    queryKey: ["clientOnboarding", id],
    queryFn: () => clientOnboardingApi.getOnboardingById(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useClientOnboardingByProjectId(projectId: string) {
  return useQuery({
    queryKey: ["clientOnboardingByProject", projectId],
    queryFn: () => clientOnboardingApi.getOnboardingByProjectId(projectId),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

export function useCreateClientOnboarding() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<
    ClientOnboarding,
    Error,
    { projectId: string; assignedUserId?: string }
  >({
    mutationFn: (data) => clientOnboardingApi.createOnboarding(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientOnboardings"] });
      toast.success(t("onboarding.admin.createOnboarding"));
    },
  });
}

export function useUpdateClientOnboarding() {
  const queryClient = useQueryClient();

  return useMutation<
    ClientOnboarding,
    Error,
    { id: string; data: any }
  >({
    mutationFn: ({ id, data }) => clientOnboardingApi.updateOnboarding(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["clientOnboardings"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboarding", id] });
    },
  });
}

export function useDeleteClientOnboarding() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => clientOnboardingApi.deleteOnboarding(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientOnboardings"] });
    },
  });
}

export function useUpdateOnboardingStep() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { stepId: string; data: any }>({
    mutationFn: ({ stepId, data }) => clientOnboardingApi.updateStep(stepId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientOnboardings"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboarding"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboardingByProject"] });
    },
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { contractId: string; data: any }>({
    mutationFn: ({ contractId, data }) =>
      clientOnboardingApi.updateContract(contractId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientOnboardings"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboarding"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboardingByProject"] });
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { paymentId: string; data: any }>({
    mutationFn: ({ paymentId, data }) =>
      clientOnboardingApi.updatePayment(paymentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientOnboardings"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboarding"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboardingByProject"] });
    },
  });
}

export function useUpdateQuestionnaire() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { questionnaireId: string; data: any }>({
    mutationFn: ({ questionnaireId, data }) =>
      clientOnboardingApi.updateQuestionnaire(questionnaireId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientOnboardings"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboarding"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboardingByProject"] });
    },
  });
}

export function useUpdateSpecifications() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { specificationsId: string; data: any }>({
    mutationFn: ({ specificationsId, data }) =>
      clientOnboardingApi.updateSpecifications(specificationsId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientOnboardings"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboarding"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboardingByProject"] });
    },
  });
}

export function useUpdateKickoff() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { kickoffId: string; data: any }>({
    mutationFn: ({ kickoffId, data }) =>
      clientOnboardingApi.updateKickoff(kickoffId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientOnboardings"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboarding"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboardingByProject"] });
    },
  });
}

export function useUpdateProduction() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { productionId: string; data: any }>({
    mutationFn: ({ productionId, data }) =>
      clientOnboardingApi.updateProduction(productionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientOnboardings"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboarding"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboardingByProject"] });
    },
  });
}

export function useUpdateDelivery() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { deliveryId: string; data: any }>({
    mutationFn: ({ deliveryId, data }) =>
      clientOnboardingApi.updateDelivery(deliveryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientOnboardings"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboarding"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboardingByProject"] });
    },
  });
}
