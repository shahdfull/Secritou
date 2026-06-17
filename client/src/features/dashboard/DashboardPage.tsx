import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Suspense, lazy } from "react";
import {
  UserPlus,
  Users,
  FolderOpen,
  CheckSquare,
  Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDashboardSummary } from "@/hooks/useDashboard";
import { useAnalyticsSummary } from "@/hooks/useAnalytics";

const DashboardCharts = lazy(() =>
  import("./DashboardCharts").then((m) => ({ default: m.DashboardCharts }))
);

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: analyticsData, isLoading: analyticsLoading } = useAnalyticsSummary();

  if (summaryLoading && analyticsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const totalLeads = summary?.totalLeads ?? 0;
  const activeClients = summary?.activeClients ?? 0;
  const ongoingProjects = summary?.ongoingProjects ?? 0;
  const completedTasks = summary?.completedTasks ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">{t("dashboard.overview")}</h1>
        <p className="text-muted-foreground">{t("dashboard.welcome")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.totalLeads")}</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <CardDescription className="text-xs">{t("dashboard.fromLastMonth")}</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.activeClients")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeClients}</div>
            <CardDescription className="text-xs">{t("dashboard.fromLastMonth")}</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.ongoingProjects")}</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ongoingProjects}</div>
            <CardDescription className="text-xs">{t("dashboard.fromLastMonth")}</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.completedTasks")}</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks}</div>
            <CardDescription className="text-xs">{t("dashboard.fromLastMonth")}</CardDescription>
          </CardContent>
        </Card>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent>
                <div className="h-80 animate-pulse rounded-md bg-muted" />
              </CardContent>
            </Card>
          </div>
        }
      >
        <DashboardCharts
          leadsByMonth={analyticsData?.leadsByMonth ?? []}
          leadsByStatus={analyticsData?.leads.byStatus ?? []}
          projectsByStatus={analyticsData?.projectsByStatus ?? []}
        />
      </Suspense>
    </div>
  );
}
