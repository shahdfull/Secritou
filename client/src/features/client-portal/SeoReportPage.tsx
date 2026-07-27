import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatNumber } from "@/utils/format";
import { clientPortalApi } from "@/api/clientPortal.api";
import { Skeleton } from "@/components/ui/skeleton";
import { MousePointerClick, Eye, Percent, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { MetricSnapshotRow } from "@/api/gscConnection.api";

interface KpiDef {
  metric: string;
  label: string;
  icon: typeof MousePointerClick;
  color: string;
  format: (value: number) => string;
  // Lower is better for average position (1st is best) — every other metric here is "higher is better".
  lowerIsBetter?: boolean;
}

const KPI_DEFS: KpiDef[] = [
  { metric: "clicks", label: "Clics", icon: MousePointerClick, color: "bg-blue-50 text-blue-600", format: (v) => formatNumber(v) },
  { metric: "impressions", label: "Impressions", icon: Eye, color: "bg-purple-50 text-purple-600", format: (v) => formatNumber(v) },
  { metric: "ctr", label: "Taux de clic (CTR)", icon: Percent, color: "bg-green-50 text-green-600", format: (v) => `${formatNumber(v)}%` },
  { metric: "position", label: "Position moyenne", icon: TrendingUp, color: "bg-orange-50 text-orange-600", format: (v) => formatNumber(v), lowerIsBetter: true },
];

function latestByMetric(rows: MetricSnapshotRow[]) {
  const byMetric = new Map<string, MetricSnapshotRow[]>();
  for (const row of rows) {
    const list = byMetric.get(row.metric) ?? [];
    list.push(row);
    byMetric.set(row.metric, list);
  }
  const result = new Map<string, { latest: MetricSnapshotRow; previous?: MetricSnapshotRow }>();
  for (const [metric, list] of byMetric) {
    const sorted = [...list].sort((a, b) => b.periodStart.localeCompare(a.periodStart));
    result.set(metric, { latest: sorted[0], previous: sorted[1] });
  }
  return result;
}

function KpiCard({ def, latest, previous }: { def: KpiDef; latest?: MetricSnapshotRow; previous?: MetricSnapshotRow }) {
  const Icon = def.icon;
  const delta = latest && previous ? latest.value - previous.value : undefined;
  const isImprovement = delta !== undefined && (def.lowerIsBetter ? delta < 0 : delta > 0);
  const isDecline = delta !== undefined && (def.lowerIsBetter ? delta > 0 : delta < 0);
  const TrendIcon = delta === undefined || delta === 0 ? Minus : isImprovement ? TrendingUp : TrendingDown;

  return (
    <Card className="rounded-3xl border border-border shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {def.label === "Taux de clic (CTR)" ? (
            <span title="CTR : taux de clic (clics ÷ impressions)">{def.label}</span>
          ) : (
            def.label
          )}
        </CardTitle>
        <div className={`p-2 rounded-full ${def.color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        {latest ? (
          <>
            <div className="text-2xl font-bold">{def.format(latest.value)}</div>
            {delta !== undefined && (
              <p
                className={[
                  "text-xs mt-1 flex items-center gap-1",
                  isImprovement ? "text-green-600" : isDecline ? "text-red-600" : "text-muted-foreground",
                ].join(" ")}
              >
                <TrendIcon className="h-3 w-3" />
                {delta > 0 ? "+" : ""}
                {formatNumber(delta)} vs période précédente
              </p>
            )}
          </>
        ) : (
          <div className="text-2xl font-bold text-muted-foreground">—</div>
        )}
      </CardContent>
    </Card>
  );
}

export function SeoReportPage() {
  const { t } = useTranslation();
  const {
    data: status,
    isLoading: statusLoading,
    isError: statusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ["clientPortalSeoStatus"],
    queryFn: clientPortalApi.getSeoStatus,
  });
  const {
    data: metrics,
    isLoading: metricsLoading,
    isError: metricsError,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ["clientPortalSeoMetrics"],
    queryFn: clientPortalApi.getSeoMetrics,
    enabled: !!status?.connected,
  });

  const byMetric = useMemo(() => latestByMetric(metrics ?? []), [metrics]);

  const retry = () => {
    void refetchStatus();
    void refetchMetrics();
  };

  return (
    <div className="container-page max-w-6xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t("integrations.gsc.title", "Référencement (SEO)")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Performance de votre site sur Google Search</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Google Search Console</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 rounded-3xl" />
              ))}
            </div>
          ) : statusError ? (
            <div className="space-y-3">
              <p className="text-sm text-red-600">{t("clientPortal.seo.techError")}</p>
              <Button variant="outline" onClick={retry}>
                {t("common.retry")}
              </Button>
            </div>
          ) : !status?.connected ? (
            <p className="text-sm text-muted-foreground">{t("clientPortal.seo.notEnabled")}</p>
          ) : metricsError ? (
            <div className="space-y-3">
              <p className="text-sm text-red-600">{t("clientPortal.seo.metricsError")}</p>
              <Button variant="outline" onClick={() => void refetchMetrics()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium">{status.siteUrl}</p>
                {status.lastSyncedAt && (
                  <p className="text-xs text-muted-foreground">
                    {t("integrations.gsc.lastSynced", "Dernière synchro")} : {formatDate(status.lastSyncedAt)}
                  </p>
                )}
              </div>

              {metricsLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-28 rounded-3xl" />
                  ))}
                </div>
              ) : !metrics || metrics.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {t("integrations.gsc.noData", "Aucune donnée pour le moment.")}
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {KPI_DEFS.map((def) => {
                    const entry = byMetric.get(def.metric);
                    return <KpiCard key={def.metric} def={def} latest={entry?.latest} previous={entry?.previous} />;
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
