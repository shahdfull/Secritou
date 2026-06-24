import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import apiClient from "@/api/axios";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Receipt } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  dueDate: string | null;
  createdAt: string;
  items?: InvoiceItem[];
  payments?: Payment[];
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  PARTIAL: "bg-yellow-100 text-yellow-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500 line-through",
};

export function InvoicesClientPage() {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ["my-invoices"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { data: Invoice[]; total: number } }>("/invoices/my");
      return res.data.data;
    },
  });

  const { data: myClient } = useQuery({
    queryKey: ["myClientProfile"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { creditBalance: number } }>("/clients/my");
      return res.data.data;
    },
  });

  const { data: creditNotes, isLoading: myCreditNotesLoading } = useQuery({
    queryKey: ["myCreditNotes"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: any[] }>("/clients/my/credit-notes");
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

  const invoices = data?.data ?? [];
  const creditNotesList = creditNotes ?? [];

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold text-ink">{t("clientPortal.invoices.title")}</h1>

      <Tabs defaultValue="invoices" className="space-y-6">
        <TabsList className="rounded-2xl">
          <TabsTrigger value="invoices" className="rounded-xl">Mes factures</TabsTrigger>
          <TabsTrigger value="credit-notes" className="rounded-xl">
            Mes avoirs
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
                  <Badge className={STATUS_COLORS[inv.status] ?? "bg-gray-100 text-gray-700"}>
                    {t(`clientPortal.invoices.statuses.${inv.status}`, inv.status)}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xl font-semibold text-ink">
                        {new Intl.NumberFormat("fr-FR", { style: "currency", currency: inv.currency }).format(inv.amount)}
                      </span>
                      {inv.amountPaid > 0 && inv.amountPaid < inv.amount && (
                        <span className="text-sm text-muted-foreground ml-2">
                          ({new Intl.NumberFormat("fr-FR", { style: "currency", currency: inv.currency }).format(inv.amountPaid)} {t("clientPortal.invoices.paidSuffix")})
                        </span>
                      )}
                    </div>
                  </div>

                  {inv.items && inv.items.length > 0 && (
                    <div className="border-t pt-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Détails des prestations</p>
                      <div className="divide-y divide-border text-sm">
                        {inv.items.map((item) => (
                          <div key={item.id} className="flex justify-between py-2 items-center">
                            <div>
                              <p className="font-medium text-ink">{item.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.quantity} x {new Intl.NumberFormat("fr-FR", { style: "currency", currency: inv.currency }).format(Number(item.unitPrice))}
                              </p>
                            </div>
                            <span className="font-medium text-ink">
                              {new Intl.NumberFormat("fr-FR", { style: "currency", currency: inv.currency }).format(Number(item.total))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {inv.payments && inv.payments.length > 0 && (
                    <div className="border-t pt-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Historique des paiements</p>
                      <div className="divide-y divide-border text-xs">
                        {inv.payments.map((payment) => (
                          <div key={payment.id} className="flex justify-between py-2 text-muted-foreground items-center">
                            <span>
                              Paiement par {payment.method || "N/A"} {payment.reference ? `(Réf: ${payment.reference})` : ""}
                              {" · "}
                              {format(new Date(payment.paidAt), "d MMMM yyyy", { locale: fr })}
                            </span>
                            <span className="font-semibold text-emerald-600">
                              -{new Intl.NumberFormat("fr-FR", { style: "currency", currency: inv.currency }).format(Number(payment.amount))}
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
          <Card className="rounded-3xl border border-border shadow-soft overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Mon solde d'avoirs</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Avoirs applicables sur vos prochaines factures.
                </p>
              </div>
              <span className="text-2xl font-bold text-emerald-600 font-mono">
                {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "TND" }).format(myClient?.creditBalance || 0)}
              </span>
            </CardHeader>
          </Card>

          <div className="space-y-4">
            {myCreditNotesLoading ? (
              <div className="flex items-center justify-center min-h-[150px]">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : creditNotesList.length === 0 ? (
              <Card className="rounded-3xl border border-border">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  Vous n'avez aucun avoir disponible.
                </CardContent>
              </Card>
            ) : (
              creditNotesList.map((cn: any) => (
                <Card key={cn.id} className="rounded-3xl border border-border shadow-soft overflow-hidden">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-mono mb-1">{cn.number}</p>
                      <CardTitle className="text-base">Avoir émis le {format(new Date(cn.createdAt), "d MMMM yyyy", { locale: fr })}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        Motif : {cn.reason}
                      </p>
                      {cn.invoice?.number && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Facture d'origine : <span className="font-mono">{cn.invoice.number}</span>
                        </p>
                      )}
                      {cn.appliedToInvoice?.number && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Appliqué sur la facture : <span className="font-mono">{cn.appliedToInvoice.number}</span>
                        </p>
                      )}
                    </div>
                    <Badge className={cn.appliedAt ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                      {cn.appliedAt ? "Appliqué" : "Disponible"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <span className="text-xl font-semibold text-emerald-600">
                      {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "TND" }).format(Number(cn.amount))}
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

