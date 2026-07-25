import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsApi } from "../api/clients.api";
import { gdprApi, type GdprEraseResult } from "../api/gdpr.api";
import type { Client, CreateClientInput, UpdateClientInput } from "../types/client";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";
import { toast } from "sonner";
import i18n from "@/i18n";
import { queryKeys } from "@/lib/query-keys";
import { downloadJson } from "@/utils/downloadJson";

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

export function useGdprExportClient() {
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => gdprApi.exportClient(id),
    onSuccess: (data, id) => {
      downloadJson(data, `client-${id}-rgpd-export.json`);
      toast.success(i18n.t("toasts.gdprExported", "Export RGPD téléchargé"));
    },
  });
}

export function useGdprEraseClient() {
  const queryClient = useQueryClient();

  return useMutation<GdprEraseResult, Error, string>({
    mutationFn: (id) => gdprApi.eraseClient(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients() });
      toast.success(
        result.mode === "deleted"
          ? i18n.t("toasts.gdprClientDeleted", "Client supprimé (RGPD)")
          : i18n.t("toasts.gdprClientAnonymized", "Données personnelles anonymisées (RGPD)")
      );
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
