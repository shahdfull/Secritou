import { useTranslation } from "react-i18next";
import { useWorkload } from "@/hooks/useWorkload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function WorkloadPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useWorkload();

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
          <h1 className="text-2xl font-bold text-ink">Charge de travail</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Tâches actives et heures déclarées par personne (7 derniers jours)</p>
        </div>
      </div>

      <Card className="rounded-2xl border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-2">
          <CardTitle className="text-sm font-semibold">Par personne</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Nom</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Tâches actives</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Heures déclarées</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.userId} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-ink">{item.userName}</td>
                    <td className="px-5 py-3 text-center text-muted-foreground tabular-nums">{item.activeTaskCount}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">{item.totalHours}h</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-muted-foreground text-sm">
                      Aucune donnée trouvée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
