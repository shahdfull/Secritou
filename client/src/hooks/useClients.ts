import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsApi } from "../api/clients.api";
import type { Client, CreateClientInput, UpdateClientInput } from "../types/client";
import { toast } from "sonner";

export function useClients() {
  return useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: () => clientsApi.getAll(),
  });
}

export function useClient(id: string) {
  return useQuery<Client>({
    queryKey: ["client", id],
    queryFn: () => clientsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation<Client, Error, CreateClientInput>({
    mutationFn: (data) => clientsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client created successfully");
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation<Client, Error, { id: string; data: Omit<UpdateClientInput, "id"> }>({
    mutationFn: ({ id, data }) => clientsApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client", data.id] });
      toast.success("Client updated successfully");
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => clientsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client deleted successfully");
    },
  });
}
