import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Invoice } from "@/api/invoices.api";
import { useInvoices, useDeleteInvoice, useSendInvoice, useCancelInvoice, useAddInvoicePayment } from "@/hooks/useInvoices";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  MoreHorizontal,
  Eye,
  Download,
  Send,
  Plus,
  Ban,
} from "lucide-react";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { useListParams } from "@/hooks/useListParams";
import { CreateInvoiceDialog } from "./components/CreateInvoiceDialog";

const ALL_STATUSES_VALUE = "__all__";

export function InvoicesPage() {
  const { t } = useTranslation();
  const { page, pageSize, search, status, updateParams } = useListParams(10);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const { data: invoicesResult, isLoading } = useInvoices({
    page,
    pageSize,
    search,
    status,
  });

  const invoices = useMemo(
    () => Array.isArray(invoicesResult?.data) ? invoicesResult.data : [],
    [invoicesResult?.data]
  );

  const deleteMutation = useDeleteInvoice();
  const sendMutation = useSendInvoice();
  const cancelMutation = useCancelInvoice();
  const paymentMutation = useAddInvoicePayment();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-800";
      case "SENT":
        return "bg-blue-100 text-blue-800";
      case "PAID":
        return "bg-green-100 text-green-800";
      case "PARTIAL":
        return "bg-yellow-100 text-yellow-800";
      case "OVERDUE":
        return "bg-red-100 text-red-800";
      case "CANCELLED":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("invoices.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("invoices.subtitle")}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Créer une facture
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
            <SelectItem value="draft">{t("invoices.statuses.draft")}</SelectItem>
            <SelectItem value="sent">{t("invoices.statuses.sent")}</SelectItem>
            <SelectItem value="paid">{t("invoices.statuses.paid")}</SelectItem>
            <SelectItem value="partial">{t("invoices.statuses.partial")}</SelectItem>
            <SelectItem value="overdue">{t("invoices.statuses.overdue")}</SelectItem>
            <SelectItem value="cancelled">{t("invoices.statuses.cancelled")}</SelectItem>
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
                      ? new Date(invoice.dueDate).toLocaleDateString()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(invoice.status)}>
                      {t(`invoices.statuses.${invoice.status.toLowerCase()}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {invoice.pdfUrl && (
                          <>
                            <DropdownMenuItem
                              onClick={() => window.open(invoice.pdfUrl, "_blank")}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              {t("invoices.view")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => window.open(invoice.pdfUrl, "_blank")}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              {t("invoices.download")}
                            </DropdownMenuItem>
                          </>
                        )}
                        {invoice.status === "DRAFT" && (
                          <DropdownMenuItem
                            onClick={() => sendMutation.mutate(invoice.id)}
                            disabled={sendMutation.isPending}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            {t("invoices.send")}
                          </DropdownMenuItem>
                        )}
                        {["SENT", "PARTIAL", "OVERDUE"].includes(invoice.status) && (
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setPaymentDialogOpen(true);
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            {t("invoices.addPayment")}
                          </DropdownMenuItem>
                        )}
                        {!["PAID", "CANCELLED", "DRAFT"].includes(invoice.status) && (
                          <DropdownMenuItem
                            onClick={() => cancelMutation.mutate(invoice.id)}
                            disabled={cancelMutation.isPending}
                            className="text-amber-600"
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            {t("invoices.cancel", "Annuler")}
                          </DropdownMenuItem>
                        )}
                        {invoice.status === "DRAFT" && (
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate(invoice.id)}
                            disabled={deleteMutation.isPending}
                            className="text-red-600"
                          >
                            <MoreHorizontal className="mr-2 h-4 w-4" />
                            {t("invoices.delete")}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
      <CreateInvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </section>
  );
}
