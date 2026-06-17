import { Suspense, lazy, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TrendingUp,
  Users,
  CheckCircle2,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { useAnalyticsSummary } from "@/hooks/useAnalytics";
import { Badge } from "@/components/ui/badge";
import { DateFilter, DateRange } from "@/components/DateFilter";

const AnalyticsCharts = lazy(() =>
  import("./AnalyticsCharts").then((m) => ({ default: m.AnalyticsCharts }))
);

export function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    return { from: thirtyDaysAgo, to: today };
  });

  const { data, isLoading, isError } = useAnalyticsSummary(dateRange.from, dateRange.to);

  const taskDonePct = useMemo(() => {
    const total = data?.tasks.total ?? 0;
    if (!total) return 0;
    return Math.round(((data?.tasks.doneCount ?? 0) / total) * 100);
  }, [data?.tasks.doneCount, data?.tasks.total]);

  const overdueCount = data?.tasks?.overdueCount ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Impossible de charger les analytics. Réessaie plus tard.
      </div>
    );
  }

  const leadsByMonth = data?.leadsByMonth ?? [];
  const revenueByMonth = data?.revenueByMonth ?? [];
  const leadsByStatus = data?.leads.byStatus ?? [];
  const projectsByStatus = data?.projectsByStatus ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Analytics</h1>
          <p className="text-muted-foreground">
            Key metrics and performance indicators
          </p>
        </div>
        <DateFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Lead Conversion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {data?.leads.conversionRate ?? 0}%
              </span>
              <span className="flex items-center text-sm text-green-600">
                <ArrowUpRight className="h-4 w-4" />
                5%
              </span>
            </div>
            <CardDescription className="text-xs">
              {data?.leads.wonCount ?? 0} leads convertis
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {data?.clients.total ?? 0}
              </span>
              <span className="flex items-center text-sm text-green-600">
                <ArrowUpRight className="h-4 w-4" />
                8%
              </span>
            </div>
            <CardDescription className="text-xs">
              {data?.clients.newThisMonth ?? 0} ce mois
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Project Completion
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {data?.projects.completionRate ?? 0}%
              </span>
              <span className="flex items-center text-sm text-green-600">
                <ArrowUpRight className="h-4 w-4" />
                3%
              </span>
            </div>
            <CardDescription className="text-xs">
              {data?.projects.completedCount ?? 0} projets
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tasks Done</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {taskDonePct}%
              </span>
              <span className="flex items-center text-sm text-green-600">
                <ArrowUpRight className="h-4 w-4" />
                15%
              </span>
            </div>
            <CardDescription className="text-xs flex items-center gap-2">
              {overdueCount} en retard
              {overdueCount > 0 && <Badge variant="destructive">{overdueCount}</Badge>}
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Chargement des graphiques…</CardTitle>
                <CardDescription>Préparation des visualisations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80 animate-pulse rounded-md bg-muted" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Chargement des graphiques…</CardTitle>
                <CardDescription>Préparation des visualisations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80 animate-pulse rounded-md bg-muted" />
              </CardContent>
            </Card>
          </div>
        }
      >
        <AnalyticsCharts
          leadsByMonth={leadsByMonth}
          revenueByMonth={revenueByMonth}
          leadsByStatus={leadsByStatus}
          projectsByStatus={projectsByStatus}
        />
      </Suspense>
    </div>
  );
}
