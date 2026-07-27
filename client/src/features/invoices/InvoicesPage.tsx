import { useCallback, useState, useMemo } from "react";
import { formatDate, formatCurrency } from "@/utils/format";
import { useTranslation } from "react-i18next";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import type { Invoice } from "@/api/invoices.api";

type CreditNote = {
  id: string;
  number: string;
  amount: number | string;
  reason?: string;
  appliedAt?: string | null;
  createdAt: string;
  client?: { name: string };
  invoice?: { number: string } | null;
  appliedToInvoice?: { number: string } | null;
};
import { useInvoices, useSendInvoice, useCancelInvoice, useRestoreInvoice, useSetReminderPaused } from "@/hooks/useInvoices";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/api/axios";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AddPaymentDialog } from "./components/AddPaymentDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Plus,
  Ban,
  BellOff,
  Bell,
  AlertCircle,
} from "lucide-react";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { useListParams } from "@/hooks/useListParams";
import { CreateInvoiceDialog } from "./components/CreateInvoiceDialog";

ModuleRegistry.registerModules([AllCommunityModule]);

// Cohérent avec la migration AG Grid de TasksListView.tsx (mêmes tokens, thème clair unique).
const gridTheme = themeQuartz.withParams({
  accentColor: "#0f766e",
  headerBackgroundColor: "#f8fafc",
  headerTextColor: "#334155",
  rowHoverColor: "#f1f5f9",
  borderColor: "#e2e8f0",
  fontFamily: "inherit",
});

const ALL_STATUSES_VALUE = "__all__";

export function InvoicesPage() {
  const { t } = useTranslation();
  const { page, pageSize, search, status, updateParams } = useListParams(10);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [sendTarget, setSendTarget] = useState<Invoice | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);

  const { data: invoicesResult, isLoading } = useInvoices({
    page,
    pageSize,
    search,
    status,
  });

  const { data: creditNotesResult, isLoading: creditNotesLoading } = useQuery({
    queryKey: ["creditNotesAll"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: CreditNote[] }>("/invoices/credit-notes/all");
      return res.data;
    },
  });

  const invoices = useMemo(
    () => Array.isArray(invoicesResult?.data) ? invoicesResult.data : [],
    [invoicesResult?.data]
  );

  const creditNotes = useMemo(
    () => Array.isArray(creditNotesResult?.data) ? creditNotesResult.data : [],
    [creditNotesResult?.data]
  );

  const { data: trashResult, isLoading: trashLoading } = useQuery({
    queryKey: ["invoices-trash", page, pageSize, search, status],
    queryFn: async () => {
      const { invoicesApi } = await import("@/api/invoices.api");
      return invoicesApi.getTrash({ page, pageSize, search, status });
    },
    placeholderData: (prev) => prev,
    staleTime: 60_000,
    enabled: showTrash,
  });

  const trashedInvoices = useMemo(
    () => Array.isArray(trashResult?.data) ? trashResult.data : [],
    [trashResult?.data]
  );

  const sendMutation = useSendInvoice();
  const cancelMutation = useCancelInvoice();
  const restoreMutation = useRestoreInvoice();
  const reminderPausedMutation = useSetReminderPaused();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-muted text-muted-foreground";
      case "SENT":
        return "bg-primary-soft text-primary-strong";
      case "PAID":
        return "bg-green-100 text-green-800";
      case "PARTIAL":
        return "bg-accent-soft text-accent-strong";
      case "OVERDUE":
        return "bg-red-100 text-red-700";
      case "CANCELLED":
        return "bg-muted text-muted-foreground line-through";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // The daily job flips SENT/PARTIAL to OVERDUE; between runs the dashboard already counts them
  // as overdue at read time, so the list derives the same status to stay consistent.
  const effectiveStatus = useCallback((invoice: Invoice) => {
    return ["SENT", "PARTIAL"].includes(invoice.status) &&
      invoice.dueDate &&
      new Date(invoice.dueDate) < new Date()
      ? "OVERDUE"
      : invoice.status;
  }, []);

  const invoiceStatusRenderer = useCallback(
    (params: ICellRendererParams<Invoice>) => {
      const invoice = params.data;
      if (!invoice) return null;
      const status = effectiveStatus(invoice);
      return (
        <div className="flex h-full items-center">
          <Badge className={getStatusColor(status)}>{t(`invoices.statuses.${status.toLowerCase()}`)}</Badge>
        </div>
      );
    },
    [t, effectiveStatus]
  );

  const invoiceActionsRenderer = useCallback(
    (params: ICellRendererParams<Invoice>) => {
      const invoice = params.data;
      if (!invoice) return null;
      const canSend = invoice.status === "DRAFT";
      const canAddPayment = ["SENT", "PARTIAL", "OVERDUE"].includes(invoice.status);
      const canToggleReminder = ["SENT", "PARTIAL", "OVERDUE"].includes(invoice.status);
      const canCancel = !["PAID", "CANCELLED"].includes(invoice.status);
      return (
        <div className="flex h-full items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={canSend ? t("invoices.send") : t("invoices.sendUnavailable", "Disponible uniquement pour les brouillons")}
            onClick={() => setSendTarget(invoice)}
            disabled={!canSend || sendMutation.isPending}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={canAddPayment ? t("invoices.addPayment.title") : t("invoices.addPaymentUnavailable", "Aucun paiement à ajouter sur cette facture")}
            onClick={() => { setSelectedInvoice(invoice); setPaymentDialogOpen(true); }}
            disabled={!canAddPayment}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={
              !canToggleReminder
                ? t("invoices.reminderUnavailable", "Pas de relance sur cette facture")
                : invoice.reminderPaused
                  ? t("invoices.resumeReminders")
                  : t("invoices.pauseReminders")
            }
            onClick={() => reminderPausedMutation.mutate({ id: invoice.id, reminderPaused: !invoice.reminderPaused })}
            disabled={!canToggleReminder || reminderPausedMutation.isPending}
          >
            {invoice.reminderPaused ? <BellOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Bell className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-amber-600 hover:bg-amber-50 disabled:text-muted-foreground"
            title={canCancel ? t("invoices.cancel", "Annuler") : t("invoices.cancelUnavailable", "Cette facture ne peut plus être annulée")}
            onClick={() => setCancelTarget(invoice)}
            disabled={!canCancel || cancelMutation.isPending}
          >
            <Ban className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    },
    [t, sendMutation, reminderPausedMutation, cancelMutation]
  );

  const invoiceColumnDefs = useMemo<ColDef<Invoice>[]>(
    () => [
      { headerName: t("invoices.number"), field: "number", flex: 1, cellClass: "font-medium" },
      { headerName: t("invoices.client"), valueGetter: (p) => p.data?.client?.name, flex: 1 },
      { headerName: t("invoices.amount"), valueFormatter: (p) => formatCurrency(p.data!.amount, p.data!.currency), field: "amount", flex: 1 },
      { headerName: t("invoices.amountPaid"), valueFormatter: (p) => formatCurrency(p.data!.amountPaid, p.data!.currency), field: "amountPaid", flex: 1 },
      { headerName: t("invoices.dueDate"), valueFormatter: (p) => (p.data?.dueDate ? formatDate(p.data.dueDate) : "-"), field: "dueDate", flex: 1 },
      { headerName: t("invoices.status"), cellRenderer: invoiceStatusRenderer, flex: 1 },
      { headerName: t("invoices.actions"), cellRenderer: invoiceActionsRenderer, width: 160, sortable: false, resizable: false },
    ],
    [t, invoiceStatusRenderer, invoiceActionsRenderer]
  );

  const creditNoteAppliedRenderer = useCallback(
    (params: ICellRendererParams<CreditNote>) => {
      const cn = params.data;
      if (!cn) return null;
      return (
        <div className="flex h-full items-center">
          {cn.appliedAt ? (
            <Badge className="bg-primary-soft text-primary-strong">
              {t("invoices.creditNotes.applied", { date: format(new Date(cn.appliedAt), "dd/MM/yyyy", { locale: fr }) })}
            </Badge>
          ) : (
            <Badge className="bg-accent-soft text-accent-strong">{t("invoices.creditNotes.available")}</Badge>
          )}
        </div>
      );
    },
    [t]
  );

  const creditNoteColumnDefs = useMemo<ColDef<CreditNote>[]>(
    () => [
      { headerName: t("invoices.creditNotes.number"), field: "number", flex: 1, cellClass: "font-mono text-sm" },
      { headerName: t("invoices.client"), valueGetter: (p) => p.data?.client?.name, flex: 1 },
      { headerName: t("invoices.amount"), valueFormatter: (p) => formatCurrency(Number(p.data!.amount), "TND"), field: "amount", flex: 1, cellClass: "font-semibold text-emerald-600" },
      { headerName: t("invoices.creditNotes.reason"), field: "reason", flex: 1, tooltipField: "reason" },
      { headerName: t("invoices.creditNotes.sourceInvoice"), valueGetter: (p) => p.data?.invoice?.number || "-", flex: 1, cellClass: "font-mono text-sm" },
      { headerName: t("invoices.creditNotes.appliedInvoice"), valueGetter: (p) => p.data?.appliedToInvoice?.number || "-", flex: 1, cellClass: "font-mono text-sm" },
      { headerName: t("invoices.creditNotes.applicationStatus"), cellRenderer: creditNoteAppliedRenderer, flex: 1 },
      { headerName: t("invoices.creditNotes.issueDate"), valueFormatter: (p) => format(new Date(p.data!.createdAt), "dd/MM/yyyy", { locale: fr }), field: "createdAt", flex: 1 },
    ],
    [t, creditNoteAppliedRenderer]
  );

  const trashActionsRenderer = useCallback(
    (params: ICellRendererParams<Invoice>) => {
      const invoice = params.data;
      if (!invoice) return null;
      return (
        <div className="flex h-full items-center justify-end">
          <Button variant="secondary" size="sm" onClick={() => restoreMutation.mutate(invoice.id)} disabled={restoreMutation.isPending}>
            {t("common.restore")}
          </Button>
        </div>
      );
    },
    [t, restoreMutation]
  );

  const trashColumnDefs = useMemo<ColDef<Invoice>[]>(
    () => [
      { headerName: t("invoices.number"), field: "number", flex: 1, cellClass: "font-medium" },
      { headerName: t("invoices.client"), valueGetter: (p) => p.data?.client?.name, flex: 1 },
      { headerName: t("invoices.amount"), valueFormatter: (p) => formatCurrency(p.data!.amount, p.data!.currency), field: "amount", flex: 1 },
      { headerName: t("invoices.actions"), cellRenderer: trashActionsRenderer, width: 120, sortable: false, resizable: false },
    ],
    [t, trashActionsRenderer]
  );

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("invoices.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("invoices.subtitle")}
          </p>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-ink text-white rounded-full hover:bg-ink/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t("invoices.createInvoice")}
        </Button>
      </div>

      <Tabs value={showTrash ? "trash" : "invoices"} onValueChange={(value) => setShowTrash(value === "trash")} className="space-y-6">
        <TabsList>
          <TabsTrigger value="invoices">{t("invoices.tabInvoices")}</TabsTrigger>
          <TabsTrigger value="credit-notes">{t("invoices.tabCreditNotes")}</TabsTrigger>
          <TabsTrigger value="trash">{t("common.trash")}</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder={t("invoices.search")}
              value={search || ""}
              onChange={(e) => updateParams({ search: e.target.value, page: 1 })}
              className="max-w-sm"
            />
            <Select
              value={status || ALL_STATUSES_VALUE}
              onValueChange={(value) =>
                updateParams({ status: value === ALL_STATUSES_VALUE ? undefined : value, page: 1 })
              }
            >
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder={t("invoices.filterByStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUSES_VALUE}>{t("invoices.allStatuses")}</SelectItem>
                <SelectItem value="DRAFT">{t("invoices.statuses.draft")}</SelectItem>
                <SelectItem value="SENT">{t("invoices.statuses.sent")}</SelectItem>
                <SelectItem value="PAID">{t("invoices.statuses.paid")}</SelectItem>
                <SelectItem value="PARTIAL">{t("invoices.statuses.partial")}</SelectItem>
                <SelectItem value="OVERDUE">{t("invoices.statuses.overdue")}</SelectItem>
                <SelectItem value="CANCELLED">{t("invoices.statuses.cancelled")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg overflow-hidden" style={{ height: 500 }}>
            <AgGridReact<Invoice>
              theme={gridTheme}
              rowData={invoices}
              columnDefs={invoiceColumnDefs}
              loading={isLoading}
              suppressCellFocus
              overlayLoadingTemplate={t("common.loading")}
              overlayNoRowsTemplate={t("invoices.empty")}
            />
          </div>

          {invoicesResult && Number.isFinite(invoicesResult.total) && (
            <DataTablePagination
              page={invoicesResult.page}
              pageSize={invoicesResult.pageSize}
              total={invoicesResult.total}
              onPageChange={(nextPage) => updateParams({ page: nextPage })}
            />
          )}
        </TabsContent>

        <TabsContent value="credit-notes" className="space-y-4">
          <p className="text-xs text-muted-foreground">{t("invoices.creditNotes.noNewCreditNoteButtonNotice")}</p>
          <div className="border rounded-lg overflow-hidden" style={{ height: 500 }}>
            <AgGridReact<CreditNote>
              theme={gridTheme}
              rowData={creditNotes}
              columnDefs={creditNoteColumnDefs}
              loading={creditNotesLoading}
              suppressCellFocus
              overlayLoadingTemplate={t("invoices.creditNotes.loading")}
              overlayNoRowsTemplate={t("invoices.creditNotes.empty")}
            />
          </div>
        </TabsContent>

        <TabsContent value="trash" className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{t("common.trash")}</h2>
                <p className="text-sm text-muted-foreground">{t("invoices.trashDesc")}</p>
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden" style={{ height: 500 }}>
              <AgGridReact<Invoice>
                theme={gridTheme}
                rowData={trashedInvoices}
                columnDefs={trashColumnDefs}
                loading={trashLoading}
                suppressCellFocus
                overlayLoadingTemplate={t("common.loading")}
                overlayNoRowsTemplate={t("invoices.emptyTrash")}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <CreateInvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <AddPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        invoice={selectedInvoice}
      />

      <AlertDialog open={!!sendTarget} onOpenChange={(open) => !open && setSendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("invoices.sendConfirmTitle", "Envoyer cette facture ?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("invoices.sendConfirmDescription", "La facture sera envoyée au client et passera au statut envoyé.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (!sendTarget) return; sendMutation.mutate(sendTarget.id); setSendTarget(null); }}>
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("invoices.cancelConfirmTitle", "Annuler cette facture ?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("invoices.cancelConfirmDescription", "Cette action est irréversible, y compris pour une facture déjà envoyée.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {cancelTarget && cancelTarget.amountPaid > 0 && (
            <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs items-start">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {t("invoices.cancelPaidWarningTitle", "Avertissement : paiements déjà enregistrés")}
                </p>
                <p className="mt-0.5">
                  {t("invoices.cancelPaidWarningBody", "{{amount}} déjà payé sur cette facture ne sera pas remboursé ni converti en avoir automatiquement par cette annulation.", {
                    amount: formatCurrency(cancelTarget.amountPaid, cancelTarget.currency),
                  })}
                </p>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (!cancelTarget) return; cancelMutation.mutate(cancelTarget.id); setCancelTarget(null); }}>
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </section>
  );
}
