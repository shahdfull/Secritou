import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  invoicesApi,
  type Invoice,
  type PaginatedResponse,
} from "../api/invoices.api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function useInvoices(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  clientId?: string;
}) {
  return useQuery<PaginatedResponse<Invoice>>({
    queryKey: ["invoices", params],
    queryFn: () => invoicesApi.getInvoices(params),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}

export function useInvoice(id: string) {
  return useQuery<Invoice>({
    queryKey: ["invoice", id],
    queryFn: () => invoicesApi.getInvoiceById(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Invoice, Error, Parameters<typeof invoicesApi.createInvoice>[0]>({
    mutationFn: (data) => invoicesApi.createInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(t("invoices.created"));
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Invoice, Error, { id: string; data: Partial<Invoice> }>({
    mutationFn: ({ id, data }) => invoicesApi.updateInvoice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(t("invoices.updated"));
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (id) => invoicesApi.deleteInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(t("invoices.deleted"));
    },
  });
}

export function useSendInvoice() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Invoice, Error, string>({
    mutationFn: (id) => invoicesApi.sendInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(t("invoices.sent"));
    },
  });
}

export function useAddInvoicePayment() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<any, Error, { id: string; data: any }>({
    mutationFn: ({ id, data }) => invoicesApi.addPayment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(t("invoices.paymentAdded"));
    },
  });
}
