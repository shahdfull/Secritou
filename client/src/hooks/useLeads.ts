import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadsApi } from "../api/leads.api";
import type { Lead, CreateLeadInput, UpdateLeadInput } from "../types/lead";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";
import { toast } from "sonner";
import type { Client } from "../types/client";
import i18n from "@/i18n";

export function useLeads(params: ListQueryParams = {}) {
  return useQuery<PaginatedResponse<Lead>>({
    queryKey: ["leads", params],
    queryFn: () => leadsApi.getAll(params),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  });
}

export function useLead(id: string) {
  return useQuery<Lead>({
    queryKey: ["lead", id],
    queryFn: () => leadsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation<Lead, Error, CreateLeadInput>({
    mutationFn: (data) => leadsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(i18n.t("toasts.leadCreated"));
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation<Lead, Error, { id: string; data: Omit<UpdateLeadInput, "id"> }>({
    mutationFn: ({ id, data }) => leadsApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead", data.id] });
      toast.success(i18n.t("toasts.leadUpdated"));
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => leadsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(i18n.t("toasts.leadDeleted"));
    },
  });
}

export function useConvertLeadToClient() {
  const queryClient = useQueryClient();

  return useMutation<Client, Error, string>({
    mutationFn: (id) => leadsApi.convertToClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(i18n.t("toasts.leadConverted"));
    },
  });
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();

  return useMutation<Lead, Error, { id: string; status: Lead["status"] }>({
    mutationFn: ({ id, status }) => leadsApi.updateLeadStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(i18n.t("toasts.leadStatusUpdated"));
    },
  });
}
