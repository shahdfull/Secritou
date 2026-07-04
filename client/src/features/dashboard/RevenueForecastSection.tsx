import { useRevenueForecast } from "@/hooks/useRevenueForecast";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ArrowRight, TrendingUp } from "lucide-react";
import type { ForecastPeriod } from "@/api/revenueForecast.api";
import { formatNumber } from "@/utils/format";

function ForecastCard({ label, period }: { label: string; period: ForecastPeriod }) {
  return (
    <Card className="rounded-2xl border border-border shadow-none">
      <CardHeader className="px-5 pt-5 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-3">
        <p className="text-2xl font-bold text-ink">
          {formatNumber(period.projectedRevenue)} <span className="text-sm font-normal text-muted-foreground">TND</span>
        </p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Factures dues</span>
            <span className="font-medium text-ink">{formatNumber(period.invoicesDue)} TND</span>
          </div>
          <div className="flex justify-between">
            <span>Pipeline propositions</span>
            <span className="font-medium text-ink">{formatNumber(period.proposalsPending)} TND</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RevenueForecastSection() {
  const { data, isLoading } = useRevenueForecast();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="rounded-2xl border border-border shadow-none">
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-ink">Prévisionnel de revenus</h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate("/app/analytics/clients")}
          className="text-xs h-7 gap-1"
        >
          Voir rentabilité clients
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {data.overdueAmount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Impayés en retard : <strong>{formatNumber(data.overdueAmount)} TND</strong>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate("/app/commercial")}
            className="ml-auto h-6 text-xs text-red-700 hover:text-red-800"
          >
            Relancer
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ForecastCard label="30 prochains jours" period={data.next30Days} />
        <ForecastCard label="60 prochains jours" period={data.next60Days} />
        <ForecastCard label="90 prochains jours" period={data.next90Days} />
      </div>

      {data.byClient.length > 0 && (
        <Card className="rounded-2xl border border-border shadow-none">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Top clients — factures à venir (90j)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="divide-y divide-border">
              {data.byClient.map((c) => (
                <div key={c.clientId} className="flex items-center justify-between py-2.5">
                  <span className="text-sm font-medium text-ink truncate max-w-[200px]">{c.clientName}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{c.invoicesDue} facture{c.invoicesDue > 1 ? "s" : ""}</span>
                    <span className="font-semibold text-ink">{formatNumber(c.amount)} TND</span>
                  </div>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/app/commercial")}
              className="mt-3 w-full h-8 text-xs rounded-full"
            >
              Voir les relances clients
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
