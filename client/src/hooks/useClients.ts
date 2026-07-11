import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsApi } from "../api/clients.api";
import type { Client, CreateClientInput, UpdateClientInput } from "../types/client";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";
import { toast } from "sonner";
import i18n from "@/i18n";
import { queryKeys } from "@/lib/query-keys";

export function useClients(params: ListQueryParams & { includeArchived?: boolean } = {}) {
  return useQuery<PaginatedResponse<Client>>({
    queryKey: queryKeys.clients(params),
    queryFn: () => clientsApi.getAll(params),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}

export function useClient(id: string, options?: { includeArchived?: boolean }) {
  return useQuery<Client>({
    queryKey: queryKeys.client(id, options),
    queryFn: () => clientsApi.getById(id, options),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation<Client, Error, CreateClientInput>({
    mutationFn: (data) => clientsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients() });
      toast.success(i18n.t("toasts.clientCreated"));
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation<Client, Error, { id: string; data: Omit<UpdateClientInput, "id"> }>({
    mutationFn: ({ id, data }) => clientsApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients() });
      queryClient.invalidateQueries({ queryKey: queryKeys.client(data.id) });
      toast.success(i18n.t("toasts.clientUpdated"));
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => clientsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients() });
      toast.success(i18n.t("toasts.clientDeleted"));
    },
  });
}

export function useRestoreClient() {
  const queryClient = useQueryClient();

  return useMutation<Client, Error, string>({
    mutationFn: (id) => clientsApi.restore(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients() });
      queryClient.invalidateQueries({ queryKey: queryKeys.client(data.id) });
      toast.success(i18n.t("toasts.clientRestored", "Client restored"));
    },
  });
}

export function useClientTrash(params: ListQueryParams & { includeArchived?: boolean } = {}) {
  return useQuery<PaginatedResponse<Client>>({
    queryKey: [...queryKeys.clients(params), "trash"],
    queryFn: () => clientsApi.getTrash(params),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}

export function useArchiveClient() {
  const queryClient = useQueryClient();

  return useMutation<Client, Error, string>({
    mutationFn: (id) => clientsApi.archive(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients() });
      queryClient.invalidateQueries({ queryKey: queryKeys.client(data.id) });
      toast.success(i18n.t("toasts.clientArchived", "Client archivé"));
    },
  });
}

export function useInviteClientUser(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    { user: { id: string; email: string; name: string } },
    Error,
    { email: string; name: string }
  >({
    mutationFn: (data) => clientsApi.invitePortalUser(clientId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.client(clientId) });
      toast.success(i18n.t("toasts.invitationSent", `Invitation envoyée à ${variables.email}`));
    },
  });
}
