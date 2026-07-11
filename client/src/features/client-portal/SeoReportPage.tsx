import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/utils/format";
import { clientPortalApi } from "@/api/clientPortal.api";

const METRIC_LABELS: Record<string, string> = {
  clicks: "Clics",
  impressions: "Impressions",
  ctr: "CTR (%)",
  position: "Position moyenne",
};

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

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("integrations.gsc.period", "Période")}</TableHead>
                      <TableHead>{t("integrations.gsc.metric", "Métrique")}</TableHead>
                      <TableHead className="text-right">{t("integrations.gsc.value", "Valeur")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metricsLoading ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8">{t("common.loading")}</TableCell>
                      </TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-sm text-muted-foreground">
                          {t("integrations.gsc.noData", "Aucune donnée pour le moment.")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{formatDate(row.periodStart)}</TableCell>
                          <TableCell>{METRIC_LABELS[row.metric] ?? row.metric}</TableCell>
                          <TableCell className="text-right font-medium">{row.value}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
