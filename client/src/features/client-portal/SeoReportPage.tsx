import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeoMetricsGrid } from "@/components/shared/SeoMetricsGrid";
import { formatDate } from "@/utils/format";
import { clientPortalApi } from "@/api/clientPortal.api";

export function SeoReportPage() {
  const { t } = useTranslation();
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["clientPortalSeoStatus"],
    queryFn: clientPortalApi.getSeoStatus,
  });
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["clientPortalSeoMetrics"],
    queryFn: clientPortalApi.getSeoMetrics,
    enabled: !!status?.connected,
  });

  const rows = useMemo(() => {
    if (!metrics) return [];
    return [...metrics].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  }, [metrics]);

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
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : !status?.connected ? (
            <p className="text-sm text-muted-foreground">
              Le suivi SEO n'est pas encore activé pour votre compte. Contactez votre chargé de projet pour l'activer.
            </p>
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

              <SeoMetricsGrid
                rows={rows}
                isLoading={metricsLoading}
                emptyMessage={t("integrations.gsc.noData", "Aucune donnée pour le moment.")}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
