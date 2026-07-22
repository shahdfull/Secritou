import { useState, useMemo } from "react";
import { formatDate, formatNumber } from "@/utils/format";
import { useTranslation } from "react-i18next";
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
import { AddPaymentDialog } from "./components/AddPaymentDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "lucide-react";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { useListParams } from "@/hooks/useListParams";
import { CreateInvoiceDialog } from "./components/CreateInvoiceDialog";

const ALL_STATUSES_VALUE = "__all__";

export function InvoicesPage() {
  const { t } = useTranslation();
  const { page, pageSize, search, status, updateParams } = useListParams(10);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showTrash, setShowTrash] = useState(false);

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

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invoices.number")}</TableHead>
                  <TableHead>{t("invoices.client")}</TableHead>
                  <TableHead>{t("invoices.amount")}</TableHead>
                  <TableHead>{t("invoices.amountPaid")}</TableHead>
                  <TableHead>{t("invoices.dueDate")}</TableHead>
                  <TableHead>{t("invoices.status")}</TableHead>
                  <TableHead className="text-right">{t("invoices.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      {t("invoices.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.number}</TableCell>
                      <TableCell>{invoice.client?.name}</TableCell>
                      <TableCell>
                        {invoice.currency} {invoice.amount}
                      </TableCell>
                      <TableCell>
                        {invoice.currency} {invoice.amountPaid}
                      </TableCell>
                      <TableCell>
                        {invoice.dueDate
                          ? formatDate(invoice.dueDate)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          // The daily job flips SENT/PARTIAL to OVERDUE; between runs the
                          // dashboard already counts them as overdue at read time, so the
                          // list derives the same status to stay consistent.
                          const effectiveStatus =
                            ["SENT", "PARTIAL"].includes(invoice.status) &&
                            invoice.dueDate &&
                            new Date(invoice.dueDate) < new Date()
                              ? "OVERDUE"
                              : invoice.status;
                          return (
                            <Badge className={getStatusColor(effectiveStatus)}>
                              {t(`invoices.statuses.${effectiveStatus.toLowerCase()}`)}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1">
                          {invoice.status === "DRAFT" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title={t("invoices.send")} onClick={() => sendMutation.mutate(invoice.id)} disabled={sendMutation.isPending}>
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {["SENT", "PARTIAL", "OVERDUE"].includes(invoice.status) && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title={t("invoices.addPayment.title")} onClick={() => { setSelectedInvoice(invoice); setPaymentDialogOpen(true); }}>
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {["SENT", "PARTIAL", "OVERDUE"].includes(invoice.status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title={invoice.reminderPaused ? t("invoices.resumeReminders") : t("invoices.pauseReminders")}
                              onClick={() => reminderPausedMutation.mutate({ id: invoice.id, reminderPaused: !invoice.reminderPaused })}
                              disabled={reminderPausedMutation.isPending}
                            >
                              {invoice.reminderPaused ? <BellOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Bell className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          {!["PAID", "CANCELLED"].includes(invoice.status) && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:bg-amber-50" title={t("invoices.cancel", "Annuler")} onClick={() => cancelMutation.mutate(invoice.id)} disabled={cancelMutation.isPending}>
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invoices.creditNotes.number")}</TableHead>
                  <TableHead>{t("invoices.client")}</TableHead>
                  <TableHead>{t("invoices.amount")}</TableHead>
                  <TableHead>{t("invoices.creditNotes.reason")}</TableHead>
                  <TableHead>{t("invoices.creditNotes.sourceInvoice")}</TableHead>
                  <TableHead>{t("invoices.creditNotes.appliedInvoice")}</TableHead>
                  <TableHead>{t("invoices.creditNotes.applicationStatus")}</TableHead>
                  <TableHead>{t("invoices.creditNotes.issueDate")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditNotesLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10">
                      {t("invoices.creditNotes.loading")}
                    </TableCell>
                  </TableRow>
                ) : creditNotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10">
                      {t("invoices.creditNotes.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  creditNotes.map((cn) => (
                    <TableRow key={cn.id}>
                      <TableCell className="font-mono text-sm">{cn.number}</TableCell>
                      <TableCell>{cn.client?.name}</TableCell>
                      <TableCell className="font-semibold text-emerald-600">
                        {formatNumber(Number(cn.amount), { minimumFractionDigits: 2 })} TND
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={cn.reason}>{cn.reason}</TableCell>
                      <TableCell className="font-mono text-sm">{cn.invoice?.number || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">{cn.appliedToInvoice?.number || "-"}</TableCell>
                      <TableCell>
                        {cn.appliedAt ? (
                          <Badge className="bg-primary-soft text-primary-strong">
                            {t("invoices.creditNotes.applied", { date: format(new Date(cn.appliedAt), "dd/MM/yyyy", { locale: fr }) })}
                          </Badge>
                        ) : (
                          <Badge className="bg-accent-soft text-accent-strong">
                            {t("invoices.creditNotes.available")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{format(new Date(cn.createdAt), "dd/MM/yyyy", { locale: fr })}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("invoices.number")}</TableHead>
                    <TableHead>{t("invoices.client")}</TableHead>
                    <TableHead>{t("invoices.amount")}</TableHead>
                    <TableHead className="text-right">{t("invoices.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trashLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-10">{t("common.loading")}</TableCell></TableRow>
                  ) : trashedInvoices.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-10">{t("invoices.emptyTrash")}</TableCell></TableRow>
                  ) : (
                    trashedInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.number}</TableCell>
                        <TableCell>{invoice.client?.name}</TableCell>
                        <TableCell>{invoice.currency} {invoice.amount}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="secondary" size="sm" onClick={() => restoreMutation.mutate(invoice.id)} disabled={restoreMutation.isPending}>
                            {t("common.restore")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
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

    </section>
  );
}