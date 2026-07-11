import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ExternalLink, Unlink } from "lucide-react";
import {
  useGscStatus,
  useStartGscConnect,
  useCompleteGscConnect,
  useDisconnectGsc,
  useClientMetrics,
} from "@/hooks/useGscConnection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/utils/format";

const METRIC_LABELS: Record<string, string> = {
  clicks: "Clics",
  impressions: "Impressions",
  ctr: "CTR (%)",
  position: "Position moyenne",
};

export function SearchConsoleTab({ clientId }: { clientId: string }) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: status, isLoading: statusLoading } = useGscStatus(clientId);
  const startConnect = useStartGscConnect(clientId);
  const completeConnect = useCompleteGscConnect(clientId);
  const disconnect = useDisconnectGsc(clientId);
  const { data: metrics, isLoading: metricsLoading } = useClientMetrics(clientId);

  // After the OAuth callback redirect, the URL carries gscPendingId/gscClientId/gscSites
  // for this client. Show a site picker so the admin/manager can finish the connection.
  const pendingSites = useMemo(() => {
    const pendingId = searchParams.get("gscPendingId");
    const gscClientId = searchParams.get("gscClientId");
    const sitesRaw = searchParams.get("gscSites");
    if (!pendingId || !sitesRaw || gscClientId !== clientId) return null;
    try {
      const sites = JSON.parse(sitesRaw) as string[];
      return { pendingId, sites };
    } catch {
      return null;
    }
  }, [searchParams, clientId]);

  const gscError = searchParams.get("gscError");
  const [selectedSite, setSelectedSite] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (pendingSites && pendingSites.sites.length > 0 && !selectedSite) {
      setSelectedSite(pendingSites.sites[0]);
    }
  }, [pendingSites, selectedSite]);

  const clearOAuthParams = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("gscPendingId");
    next.delete("gscClientId");
    next.delete("gscSites");
    next.delete("gscError");
    setSearchParams(next, { replace: true });
  };

  const handleConnect = async () => {
    const { url } = await startConnect.mutateAsync();
    window.location.href = url;
  };

  const handleCompleteConnect = () => {
    if (!pendingSites || !selectedSite) return;
    completeConnect.mutate(
      { pendingId: pendingSites.pendingId, siteUrl: selectedSite },
      { onSuccess: clearOAuthParams }
    );
  };

  const rows = useMemo(() => {
    if (!metrics) return [];
    return [...metrics].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  }, [metrics]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("integrations.gsc.title", "Google Search Console")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {gscError && (
          <p className="text-sm text-red-600">
            {t("integrations.gsc.error", "La connexion a échoué")} : {gscError}
          </p>
        )}

        {pendingSites && (
          <div className="border rounded-lg p-4 space-y-3 bg-accent-soft/30">
            <p className="text-sm font-medium">
              {t("integrations.gsc.pickSite", "Choisissez la propriété Search Console à connecter")}
            </p>
            {pendingSites.sites.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("integrations.gsc.noSites", "Aucune propriété Search Console visible avec ce compte Google.")}
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={selectedSite} onValueChange={setSelectedSite}>
                  <SelectTrigger className="max-w-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingSites.sites.map((site) => (
                      <SelectItem key={site} value={site}>{site}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleCompleteConnect} disabled={!selectedSite || completeConnect.isPending}>
                  {completeConnect.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t("integrations.gsc.confirm", "Confirmer")}
                </Button>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={clearOAuthParams}>
              {t("common.cancel", "Annuler")}
            </Button>
          </div>
        )}

        {statusLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : status?.connected ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{status.siteUrl}</p>
              <p className="text-xs text-muted-foreground">
                {status.lastSyncedAt
                  ? `${t("integrations.gsc.lastSynced", "Dernière synchro")} : ${formatDate(status.lastSyncedAt)}`
                  : t("integrations.gsc.neverSynced", "Pas encore synchronisé")}
              </p>
              {status.lastSyncError && (
                <p className="text-xs text-red-600">{status.lastSyncError}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              <Unlink className="h-3.5 w-3.5 mr-2" />
              {t("integrations.gsc.disconnect", "Déconnecter")}
            </Button>
          </div>
        ) : (
          !pendingSites && (
            <Button onClick={handleConnect} disabled={startConnect.isPending}>
              {startConnect.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
              {t("integrations.gsc.connect", "Connecter Search Console")}
            </Button>
          )
        )}

        {status?.connected && (
          <div className="border rounded-lg overflow-hidden mt-4">
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
                      {t("integrations.gsc.noData", "Aucune donnée pour le moment — la première synchronisation a lieu dans la nuit suivant la connexion.")}
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
        )}
      </CardContent>
    </Card>
  );
}
