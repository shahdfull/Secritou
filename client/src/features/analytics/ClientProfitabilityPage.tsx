import { useState } from "react";
import { formatDate } from "@/utils/format";
import { useTranslation } from "react-i18next";
import { useClientProfitability } from "@/hooks/useClientProfitability";
import type { ClientProfitabilityItem, ClientHealthStatus } from "@/api/clientProfitability.api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const HEALTH_CONFIG: Record<ClientHealthStatus, { label: string; className: string }> = {
  champion: { label: "Champion", className: "bg-green-100 text-green-800" },
  good: { label: "Bon", className: "bg-blue-100 text-blue-800" },
  "at-risk": { label: "À risque", className: "bg-orange-100 text-orange-800" },
  lost: { label: "Inactif", className: "bg-gray-100 text-gray-500" },
};

function ClientDetailModal({
  client,
  onClose,
}: {
  client: ClientProfitabilityItem | null;
  onClose: () => void;
}) {
  if (!client) return null;
  const health = HEALTH_CONFIG[client.healthStatus];
  return (
    <Dialog open={!!client} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{client.clientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Badge className={health.className}>{health.label}</Badge>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Revenus encaissés</p>
              <p className="font-semibold text-ink">{client.totalRevenue.toLocaleString("fr-FR")} TND</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">En attente</p>
              <p className="font-semibold text-ink">{client.pendingRevenue.toLocaleString("fr-FR")} TND</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Projets</p>
              <p className="font-semibold text-ink">{client.completedProjects}/{client.totalProjects} complétés</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Durée moy. projet</p>
              <p className="font-semibold text-ink">
                {client.avgProjectDurationDays > 0 ? `${client.avgProjectDurationDays}j` : "—"}
              </p>
            </div>
            {client.lastProjectCompletedAt && (
              <div className="space-y-1 col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Dernier projet complété</p>
                <p className="font-semibold text-ink">
                  {formatDate(client.lastProjectCompletedAt)}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ClientProfitabilityPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useClientProfitability();
  const [selected, setSelected] = useState<ClientProfitabilityItem | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const items = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/app" aria-label={t("nav.dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-ink">Rentabilité par client</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Classement par revenus encaissés</p>
        </div>
      </div>

      <Card className="rounded-2xl border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-2">
          <CardTitle className="text-sm font-semibold">Tous les clients</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Client</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Encaissé</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">En attente</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Projets</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Santé</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const health = HEALTH_CONFIG[item.healthStatus];
                  return (
                    <tr
                      key={item.clientId}
                      className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setSelected(item)}
                    >
                      <td className="px-5 py-3 font-medium text-ink">{item.clientName}</td>
                      <td className="px-5 py-3 text-right font-semibold text-ink tabular-nums">
                        {item.totalRevenue.toLocaleString("fr-FR")} TND
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">
                        {item.pendingRevenue > 0
                          ? `${item.pendingRevenue.toLocaleString("fr-FR")} TND`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-center text-muted-foreground">
                        {item.completedProjects}/{item.totalProjects}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Badge className={`${health.className} text-xs`}>{health.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground text-sm">
                      Aucun client trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ClientDetailModal client={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
