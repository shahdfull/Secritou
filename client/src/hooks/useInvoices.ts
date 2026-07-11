import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  invoicesApi,
  type Invoice,
  type PaginatedResponse,
} from "../api/invoices.api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { QueryClient } from "@tanstack/react-query";

// Invoice mutations must also invalidate the dashboard/exec aggregates: they
// read overdue/finance counters independently of the invoices list (own query
// keys, own staleTime), so without this an invoice change leaves the
// dashboard showing stale counts until its own cache expires. See audit 09 §3.
function invalidateInvoiceRelatedCaches(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["invoices"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  queryClient.invalidateQueries({ queryKey: ["analytics"] });
}

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
      invalidateInvoiceRelatedCaches(queryClient);
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
      invalidateInvoiceRelatedCaches(queryClient);
      toast.success(t("invoices.updated"));
    },
  });
}

export function useSendInvoice() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Invoice, Error, string>({
    mutationFn: (id) => invoicesApi.sendInvoice(id),
    onSuccess: () => {
      invalidateInvoiceRelatedCaches(queryClient);
      toast.success(t("invoices.sent"));
    },
  });
}

export function useSetReminderPaused() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Invoice, Error, { id: string; reminderPaused: boolean }>({
    mutationFn: ({ id, reminderPaused }) => invoicesApi.setReminderPaused(id, reminderPaused),
    onSuccess: (_data, variables) => {
      invalidateInvoiceRelatedCaches(queryClient);
      toast.success(
        variables.reminderPaused
          ? t("invoices.reminderPaused", "Relances automatiques désactivées")
          : t("invoices.reminderResumed", "Relances automatiques réactivées")
      );
    },
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Invoice, Error, string>({
    mutationFn: (id) => invoicesApi.cancelInvoice(id),
    onSuccess: () => {
      invalidateInvoiceRelatedCaches(queryClient);
      toast.success(t("invoices.cancelled", "Facture annulée"));
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Invoice, Error, string>({
    mutationFn: (id) => invoicesApi.deleteInvoice(id),
    onSuccess: () => {
      invalidateInvoiceRelatedCaches(queryClient);
      toast.success(t("invoices.deleted", "Facture supprimée"));
    },
  });
}

export function useRestoreInvoice() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Invoice, Error, string>({
    mutationFn: (id) => invoicesApi.restoreInvoice(id),
    onSuccess: () => {
      invalidateInvoiceRelatedCaches(queryClient);
      toast.success(t("invoices.restored", "Facture restaurée"));
    },
  });
}

export function useAddInvoicePayment() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<any, Error, { id: string; data: any }>({
    mutationFn: ({ id, data }) => invoicesApi.addPayment(id, data),
    onSuccess: (result) => {
      invalidateInvoiceRelatedCaches(queryClient);
      toast.success(t("invoices.paymentAdded"));
      // Backend returns a warning when the payment exceeds the invoice balance.
      const warning = (result as { warning?: string })?.warning;
      if (warning) toast.warning(warning);
    },
  });
}
