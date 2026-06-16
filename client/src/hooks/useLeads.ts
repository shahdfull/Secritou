import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadsApi } from "../api/leads.api";
import type { Lead, CreateLeadInput, UpdateLeadInput } from "../types/lead";
import { toast } from "sonner";
import type { Client } from "../types/client";

export function useLeads() {
  return useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: () => leadsApi.getAll(),
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead created successfully");
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
      toast.success("Lead updated successfully");
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => leadsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead deleted successfully");
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
      toast.success("Lead converted to client successfully");
    },
  });
}
