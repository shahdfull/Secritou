import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clientOnboardingApi,
  type ClientOnboarding,
  type OnboardingStep,
  type Contract,
  type Payment,
  type Questionnaire,
  type Specifications,
  type KickoffMeeting,
  type ProductionProgress,
  type Delivery,
  type CreateOnboardingPayload,
  type UpdateOnboardingPayload,
  type UpdateStepPayload,
  type ContractPayload,
  type PaymentPayload,
  type QuestionnairePayload,
  type SpecificationsPayload,
  type KickoffPayload,
  type ProductionPayload,
  type DeliveryPayload,
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

export function useClientOnboardingByClientId(clientId: string) {
  return useQuery({
    queryKey: ["clientOnboardingByClient", clientId],
    queryFn: () => clientOnboardingApi.getOnboardingByClientId(clientId),
    enabled: !!clientId,
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
    CreateOnboardingPayload
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
    { id: string; data: UpdateOnboardingPayload }
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

  return useMutation<OnboardingStep, Error, { stepId: string; data: UpdateStepPayload }>({
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

  return useMutation<Contract, Error, { contractId: string; data: ContractPayload }>({
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

  return useMutation<Payment, Error, { paymentId: string; data: PaymentPayload }>({
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

  return useMutation<Questionnaire, Error, { questionnaireId: string; data: QuestionnairePayload }>({
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

  return useMutation<Specifications, Error, { specificationsId: string; data: SpecificationsPayload }>({
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

  return useMutation<KickoffMeeting, Error, { kickoffId: string; data: KickoffPayload }>({
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

  return useMutation<ProductionProgress, Error, { productionId: string; data: ProductionPayload }>({
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

  return useMutation<Delivery, Error, { deliveryId: string; data: DeliveryPayload }>({
    mutationFn: ({ deliveryId, data }) =>
      clientOnboardingApi.updateDelivery(deliveryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientOnboardings"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboarding"] });
      queryClient.invalidateQueries({ queryKey: ["clientOnboardingByProject"] });
    },
  });
}
