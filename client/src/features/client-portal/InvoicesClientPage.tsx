import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import apiClient from "@/api/axios";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Receipt } from "lucide-react";

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const invoices = data?.data ?? [];

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold text-ink">{t("clientPortal.invoices.title")}</h1>

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
          <Card key={inv.id} className="rounded-3xl border border-border shadow-soft">
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
            <CardContent className="flex items-center justify-between">
              <div>
                <span className="text-xl font-semibold">
                  {new Intl.NumberFormat("fr-FR", { style: "currency", currency: inv.currency }).format(inv.amount)}
                </span>
                {inv.amountPaid > 0 && inv.amountPaid < inv.amount && (
                  <span className="text-sm text-muted-foreground ml-2">
                    ({new Intl.NumberFormat("fr-FR", { style: "currency", currency: inv.currency }).format(inv.amountPaid)} {t("clientPortal.invoices.paidSuffix")})
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
