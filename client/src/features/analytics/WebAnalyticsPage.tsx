import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { formatMonthKey } from "@/utils/format";
import { useAnalyticsEventSummary } from "@/hooks/useAnalyticsEvents";

export function WebAnalyticsPage() {
  const { data, isLoading } = useAnalyticsEventSummary();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const summary = data ?? { total: 0, byName: [], eventsByMonth: [], topPages: [], funnels: { ctaToContact: { ctaClicked: 0, contactFormSubmitted: 0, contactFormFailed: 0, conversionRate: 0 } } };
  const funnel = summary.funnels.ctaToContact;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/app" aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-ink">Analytics web</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {summary.total} événements sur les 12 derniers mois
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Événements par mois</CardTitle>
            <CardDescription>Volume total d'événements suivis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.eventsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tickFormatter={(key: string) => formatMonthKey(key)} tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                    }}
                    labelFormatter={(key: string) => formatMonthKey(key)}
                  />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Événements par type</CardTitle>
            <CardDescription>Répartition des événements suivis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.byName} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} className="text-xs" width={140} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border border-border shadow-none">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold">Pages les plus visitées</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Page</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Vues</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topPages.map((page) => (
                    <tr key={page.pagePath} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 font-medium text-ink">{page.pagePath}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">{page.count}</td>
                    </tr>
                  ))}
                  {summary.topPages.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-5 py-10 text-center text-muted-foreground text-sm">
                        Aucune donnée disponible.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funnel CTA → Contact</CardTitle>
            <CardDescription>Taux de conversion des clics CTA vers un formulaire soumis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Clics CTA</span>
                <span className="font-semibold text-ink tabular-nums">{funnel.ctaClicked}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Formulaires soumis</span>
                <span className="font-semibold text-ink tabular-nums">{funnel.contactFormSubmitted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Formulaires échoués</span>
                <span className="font-semibold text-ink tabular-nums">{funnel.contactFormFailed}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-muted-foreground">Taux de conversion</span>
                <span className="font-semibold text-ink tabular-nums">{funnel.conversionRate}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
