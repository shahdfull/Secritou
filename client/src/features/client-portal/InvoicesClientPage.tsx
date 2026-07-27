import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import apiClient from "@/api/axios";
import { documentsApi } from "@/api/documents.api";
import { formatCurrency } from "@/utils/format";
import { getInvoiceStatusBadgeClass, getCreditNoteBadgeClass } from "@/utils/statusColors";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Download, Receipt, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CreditNote = {
  id: string;
  number: string;
  amount: number | string;
  reason?: string;
  appliedAt?: string | null;
  createdAt: string;
  invoice?: { number: string } | null;
  appliedToInvoice?: { number: string } | null;
};

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type Payment = {
  id: string;
  amount: number;
  method: string | null;
  reference: string | null;
  paidAt: string;
};

type Invoice = {
  id: string;
  number: string;
  title: string;
  amount: number;
  amountPaid: number;
  currency: string;
  status: string;
  pdfUrl?: string | null;
  dueDate: string | null;
  createdAt: string;
  items?: InvoiceItem[];
  payments?: Payment[];
  documents?: { id: string }[];
};

// Per-section inline error with its own retry, matching the same pattern used across the
// client portal (ClientDashboardPage's BlockError) — three independent queries below (invoices,
// credit balance, credit notes) so one failing must not hide the others that loaded fine.
function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Card className="rounded-3xl border border-destructive/30">
      <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-destructive">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          {t("common.retry")}
        </Button>
      </CardContent>
    </Card>
  );
}

function InvoiceDownloadButton({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation();
  const documentId = invoice.documents?.[0]?.id;
  const downloadMutation = useMutation({
    mutationFn: () => documentsApi.getDownloadUrl(documentId!),
    onSuccess: ({ url }) => window.open(url, "_blank"),
  });

  // documentId is the same generated PDF as pdfUrl (see invoice.service.ts's
  // assertInvoicePdfNotGenerated) — prefer the signed-URL flow shared with the rest of the
  // portal, fall back to the raw link only if no Document row exists yet for this invoice.
  if (documentId) {
    return (
      <Button variant="outline" size="sm" onClick={() => downloadMutation.mutate()} disabled={downloadMutation.isPending}>
        <Download className="mr-2 h-4 w-4" />
        {t("clientPortal.invoices.pdf", "PDF")}
      </Button>
    );
  }

  if (invoice.pdfUrl) {
    return (
      <Button variant="outline" size="sm" asChild>
        <a href={invoice.pdfUrl} target="_blank" rel="noreferrer">
          <Download className="mr-2 h-4 w-4" />
          {t("clientPortal.invoices.pdf", "PDF")}
        </a>
      </Button>
    );
  }

  return null;
}

export function InvoicesClientPage() {
  const { t } = useTranslation();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-invoices"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { data: Invoice[]; total: number } }>("/invoices/my");
      return res.data.data;
    },
  });

  const { data: myClient, isLoading: myClientLoading, isError: myClientError, refetch: refetchMyClient } = useQuery({
    queryKey: ["myClientProfile"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { creditBalance: number } }>("/clients/my");
      return res.data.data;
    },
  });

  const {
    data: creditNotes,
    isLoading: myCreditNotesLoading,
    isError: myCreditNotesError,
    refetch: refetchCreditNotes,
  } = useQuery({
    queryKey: ["myCreditNotes"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: CreditNote[] }>("/clients/my/credit-notes");
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError) {
    return <SectionError message={t("clientPortal.invoices.invoicesLoadFailed")} onRetry={() => refetch()} />;
  }

  const invoices = data?.data ?? [];
  const creditNotesList = creditNotes ?? [];

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold text-ink">{t("clientPortal.invoices.title")}</h1>

      <Tabs defaultValue="invoices" className="space-y-6">
        <TabsList className="rounded-2xl">
          <TabsTrigger value="invoices" className="rounded-xl">{t("clientPortal.invoices.tabs.invoices")}</TabsTrigger>
          <TabsTrigger value="credit-notes" className="rounded-xl">
            {t("clientPortal.invoices.tabs.creditNotes")}
            {creditNotesList.length > 0 && (
              <Badge className="ml-1.5 h-4 px-1.5 text-[10px] bg-primary text-primary-foreground">
                {creditNotesList.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4">
          {invoices.length === 0 && (
            <Card className="rounded-3xl border border-border">
              <CardContent className="py-16 text-center text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
                {t("clientPortal.invoices.empty")}
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {invoices.map((inv) => (
              <Card key={inv.id} className="rounded-3xl border border-border shadow-soft overflow-hidden">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground font-mono mb-1">{inv.number}</p>
                    <CardTitle className="text-base">{inv.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("clientPortal.invoices.issuedOn")} {format(new Date(inv.createdAt), "d MMMM yyyy", { locale: fr })}
                      {inv.dueDate && (
                        <> · {t("clientPortal.invoices.dueDate")} {format(new Date(inv.dueDate), "d MMMM yyyy", { locale: fr })}</>
                      )}
                    </p>
                  </div>
                  <Badge className={getInvoiceStatusBadgeClass(inv.status)}>
                    {t(`clientPortal.invoices.statuses.${inv.status}`, inv.status)}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xl font-semibold text-ink">
                        {formatCurrency(inv.amount, inv.currency)}
                      </span>
                      {inv.amountPaid > 0 && inv.amountPaid < inv.amount && (
                        <span className="text-sm text-muted-foreground ml-2">
                          ({formatCurrency(inv.amountPaid, inv.currency)} {t("clientPortal.invoices.paidSuffix")})
                        </span>
                      )}
                    </div>
                    <InvoiceDownloadButton invoice={inv} />
                  </div>

                  {inv.items && inv.items.length > 0 && (
                    <div className="border-t pt-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {t("clientPortal.invoices.itemsDetail")}
                      </p>
                      <div className="divide-y divide-border text-sm">
                        {inv.items.map((item) => (
                          <div key={item.id} className="flex justify-between py-2 items-center">
                            <div>
                              <p className="font-medium text-ink">{item.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.quantity} x {formatCurrency(Number(item.unitPrice), inv.currency)}
                              </p>
                            </div>
                            <span className="font-medium text-ink">
                              {formatCurrency(Number(item.total), inv.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {inv.payments && inv.payments.length > 0 && (
                    <div className="border-t pt-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {t("clientPortal.invoices.paymentsHistory")}
                      </p>
                      <div className="divide-y divide-border text-xs">
                        {inv.payments.map((payment) => (
                          <div key={payment.id} className="flex justify-between py-2 text-muted-foreground items-center">
                            <span>
                              {t("clientPortal.invoices.paymentBy")} {payment.method || "N/A"}{" "}
                              {payment.reference ? `(${t("clientPortal.invoices.reference")}: ${payment.reference})` : ""}
                              {" · "}
                              {format(new Date(payment.paidAt), "d MMMM yyyy", { locale: fr })}
                            </span>
                            <span className="font-semibold text-emerald-600">
                              -{formatCurrency(Number(payment.amount), inv.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="credit-notes" className="space-y-4">
          {myClientError ? (
            <SectionError message={t("clientPortal.invoices.creditBalanceLoadFailed")} onRetry={() => refetchMyClient()} />
          ) : (
            <Card className="rounded-3xl border border-border shadow-soft overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{t("clientPortal.invoices.creditBalanceTitle")}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {t("clientPortal.invoices.creditBalanceSubtitle")}
                  </p>
                </div>
                {myClientLoading ? (
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-2xl font-bold text-emerald-600 font-mono">
                    {formatCurrency(myClient?.creditBalance || 0, "TND")}
                  </span>
                )}
              </CardHeader>
            </Card>
          )}

          <div className="space-y-4">
            {myCreditNotesLoading ? (
              <div className="flex items-center justify-center min-h-[150px]">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : myCreditNotesError ? (
              <SectionError message={t("clientPortal.invoices.creditNotesLoadFailed")} onRetry={() => refetchCreditNotes()} />
            ) : creditNotesList.length === 0 ? (
              <Card className="rounded-3xl border border-border">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  {t("clientPortal.invoices.creditNotesEmpty")}
                </CardContent>
              </Card>
            ) : (
              creditNotesList.map((cn) => (
                <Card key={cn.id} className="rounded-3xl border border-border shadow-soft overflow-hidden">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-mono mb-1">{cn.number}</p>
                      <CardTitle className="text-base">
                        {t("clientPortal.invoices.creditNoteIssuedOn")} {format(new Date(cn.createdAt), "d MMMM yyyy", { locale: fr })}
                      </CardTitle>
                      {cn.reason && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("clientPortal.invoices.creditNoteReason")} : {cn.reason}
                        </p>
                      )}
                      {cn.invoice?.number && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("clientPortal.invoices.creditNoteOriginInvoice")} : <span className="font-mono">{cn.invoice.number}</span>
                        </p>
                      )}
                      {cn.appliedToInvoice?.number && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("clientPortal.invoices.creditNoteAppliedToInvoice")} : <span className="font-mono">{cn.appliedToInvoice.number}</span>
                        </p>
                      )}
                    </div>
                    <Badge className={getCreditNoteBadgeClass(!!cn.appliedAt)}>
                      {cn.appliedAt ? t("clientPortal.invoices.creditNoteApplied") : t("clientPortal.invoices.creditNoteAvailable")}
                    </Badge>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <span className="text-xl font-semibold text-emerald-600">
                      {formatCurrency(Number(cn.amount), "TND")}
                    </span>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
