import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Suspense, lazy, useDeferredValue, useMemo, useState } from "react";
import {
  UserPlus,
  Users,
  FolderOpen,
  CheckSquare,
  Loader2,
  TrendingUp,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Plus,
  CheckCheck,
  Receipt,
  ClipboardList,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDashboardFull } from "@/hooks/useDashboard";
import { useAnalyticsSummary } from "@/hooks/useAnalytics";
import { useCreateLead } from "@/hooks/useLeads";
import { DateFilter, DateRange } from "@/components/DateFilter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DashboardCharts = lazy(() =>
  import("./DashboardCharts").then((m) => ({ default: m.DashboardCharts }))
);

const AnalyticsCharts = lazy(() =>
  import("../analytics/AnalyticsCharts").then((m) => ({ default: m.AnalyticsCharts }))
);

function calculateGrowth(current: number, previous: number): {
  value: string;
  isPositive: boolean;
} {
  if (previous === 0) {
    return { value: ":", isPositive: false };
  }
  const growth = ((current - previous) / previous) * 100;
  const rounded = Math.round(growth);
  if (rounded > 0) {
    return { value: `+${rounded}%`, isPositive: true };
  } else if (rounded < 0) {
    return { value: `${rounded}%`, isPositive: false };
  } else {
    return { value: "0%", isPositive: false };
  }
}

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: fullDashboard, isLoading: summaryLoading } = useDashboardFull();
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const { mutate: createLead, isPending: isCreatingLead } = useCreateLead();

  const pendingApprovalsCount = fullDashboard?.pendingApprovalsCount ?? 0;
  const overdueInvoicesCount = fullDashboard?.overdueInvoicesCount ?? 0;
  const hotLeadsCount = fullDashboard?.hotLeadsCount ?? 0;

  const handleCreateLead = () => {
    if (!leadName.trim()) return;
    createLead(
      { name: leadName.trim(), email: leadEmail.trim() || undefined, status: "NEW" },
      {
        onSuccess: () => {
          setNewLeadOpen(false);
          setLeadName("");
          setLeadEmail("");
          navigate("/app/crm");
        },
      }
    );
  };

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    return { from: thirtyDaysAgo, to: today };
  });

  // Defer date range changes so rapid picker interactions don't trigger 5 simultaneous API calls
  const deferredDateRange = useDeferredValue(dateRange);

  const { data: analyticsData, isLoading: analyticsLoading } = useAnalyticsSummary(
    deferredDateRange.from,
    deferredDateRange.to
  );

  const taskDonePct = analyticsData?.tasks.taskDonePct ?? (() => {
    const total = analyticsData?.tasks.total ?? 0;
    if (!total) return 0;
    return Math.round(((analyticsData?.tasks.doneCount ?? 0) / total) * 100);
  })();

  const overdueCount = analyticsData?.tasks?.overdueCount ?? 0;

  // Calculate growth stats
  const leadGrowth = useMemo(() => {
    if (!analyticsData?.leads) return { value: ":", isPositive: false };
    return calculateGrowth(analyticsData.leads.conversionRate, analyticsData.leads.previousConversionRate ?? 0);
  }, [analyticsData?.leads]);

  const clientGrowth = useMemo(() => {
    if (!analyticsData?.clients) return { value: ":", isPositive: false };
    return calculateGrowth(analyticsData.clients.newThisMonth, analyticsData.clients.previousNew ?? 0);
  }, [analyticsData?.clients]);

  const projectGrowth = useMemo(() => {
    if (!analyticsData?.projects) return { value: ":", isPositive: false };
    return calculateGrowth(analyticsData.projects.completionRate, analyticsData.projects.previousCompletionRate ?? 0);
  }, [analyticsData?.projects]);

  const taskGrowth = useMemo(() => {
    if (!analyticsData?.tasks) return { value: ":", isPositive: false };
    return calculateGrowth(taskDonePct, analyticsData.tasks.previousTaskDonePct ?? 0);
  }, [analyticsData?.tasks, taskDonePct]);

  if (summaryLoading && analyticsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const totalLeads = fullDashboard?.totalLeads ?? 0;
  const activeClients = fullDashboard?.activeClients ?? 0;
  const ongoingProjects = fullDashboard?.ongoingProjects ?? 0;
  const completedTasks = fullDashboard?.completedTasks ?? 0;

  const leadsByMonth = analyticsData?.leadsByMonth ?? [];
  const revenueByMonth = analyticsData?.revenueByMonth ?? [];
  const leadsByStatus = analyticsData?.leads.byStatus ?? [];
  const projectsByStatus = analyticsData?.projectsByStatus ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{t("dashboard.overview")}</h1>
          <p className="text-muted-foreground">{t("dashboard.welcome")}</p>
        </div>
      </div>

      {/* Priority Alerts */}
      {(pendingApprovalsCount > 0 || overdueInvoicesCount > 0 || hotLeadsCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {pendingApprovalsCount > 0 && (
            <button
              onClick={() => navigate("/app/commercial")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-sm font-medium hover:bg-orange-100 transition-colors"
            >
              <AlertTriangle className="h-4 w-4" />
              {pendingApprovalsCount} {t("dashboard.pendingApprovals", { count: pendingApprovalsCount })}
            </button>
          )}
          {overdueInvoicesCount > 0 && (
            <button
              onClick={() => navigate("/app/commercial")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm font-medium hover:bg-red-100 transition-colors"
            >
              <Receipt className="h-4 w-4" />
              {overdueInvoicesCount} {t("dashboard.overdueInvoices", { count: overdueInvoicesCount })}
            </button>
          )}
          {hotLeadsCount > 0 && (
            <button
              onClick={() => navigate("/app/crm")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              {hotLeadsCount} {t("dashboard.hotLeads", { count: hotLeadsCount })}
            </button>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setNewLeadOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("dashboard.newLead")}
        </Button>
        <Button variant="outline" onClick={() => navigate("/app/projects")}>
          <ClipboardList className="h-4 w-4 mr-2" />
          {t("dashboard.newTask")}
        </Button>
        <Button variant="outline" onClick={() => navigate("/app/commercial")}>
          <CheckCheck className="h-4 w-4 mr-2" />
          {t("dashboard.viewApprovals")}
        </Button>
      </div>

      {/* New Lead Dialog */}
      <Dialog open={newLeadOpen} onOpenChange={setNewLeadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard.newLead")}</DialogTitle>
            <DialogDescription>{t("dashboard.newLeadDialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="lead-name">{t("dashboard.leadNameLabel")}</Label>
              <Input
                id="lead-name"
                placeholder={t("dashboard.leadNamePlaceholder")}
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">{t("common.email")}</Label>
              <Input
                id="lead-email"
                type="email"
                placeholder={t("dashboard.leadEmailPlaceholder")}
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewLeadOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleCreateLead} disabled={isCreatingLead || !leadName.trim()}>
              {isCreatingLead && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("dashboard.createAndViewCrm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("dashboard.tabOverview")}</TabsTrigger>
          <TabsTrigger value="trends">{t("dashboard.tabTrends")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
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
        </TabsContent>

        <TabsContent value="trends" className="space-y-6 mt-6">
          <div className="flex justify-end">
            <DateFilter value={dateRange} onChange={setDateRange} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t("dashboard.leadConversion")}</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">
                        {analyticsData?.leads.conversionRate ?? 0}%
                      </span>
                      <span className={`flex items-center text-sm ${leadGrowth.isPositive ? "text-green-600" : "text-red-600"}`}>
                        {leadGrowth.isPositive ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                        {leadGrowth.value}
                      </span>
                    </div>
                    <CardDescription className="text-xs">
                      {analyticsData?.leads.wonCount ?? 0} {t("dashboard.leadsConverted")}
                    </CardDescription>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t("dashboard.activeClientsCard")}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">
                        {analyticsData?.clients.total ?? 0}
                      </span>
                      <span className={`flex items-center text-sm ${clientGrowth.isPositive ? "text-green-600" : "text-red-600"}`}>
                        {clientGrowth.isPositive ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                        {clientGrowth.value}
                      </span>
                    </div>
                    <CardDescription className="text-xs">
                      {analyticsData?.clients.newThisMonth ?? 0} {t("dashboard.thisMonth")}
                    </CardDescription>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("dashboard.projectCompletion")}
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">
                        {analyticsData?.projects.completionRate ?? 0}%
                      </span>
                      <span className={`flex items-center text-sm ${projectGrowth.isPositive ? "text-green-600" : "text-red-600"}`}>
                        {projectGrowth.isPositive ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                        {projectGrowth.value}
                      </span>
                    </div>
                    <CardDescription className="text-xs">
                      {analyticsData?.projects.completedCount ?? 0} {t("dashboard.projectsCount")}
                    </CardDescription>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t("dashboard.tasksDone")}</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">
                        {taskDonePct}%
                      </span>
                      <span className={`flex items-center text-sm ${taskGrowth.isPositive ? "text-green-600" : "text-red-600"}`}>
                        {taskGrowth.isPositive ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                        {taskGrowth.value}
                      </span>
                    </div>
                    <CardDescription className="text-xs flex items-center gap-2">
                      {overdueCount} {t("dashboard.overdueCount")}
                      {overdueCount > 0 && <Badge variant="destructive">{overdueCount}</Badge>}
                    </CardDescription>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Suspense
            fallback={
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("dashboard.chartsLoading")}</CardTitle>
                    <CardDescription>{t("dashboard.chartsLoadingDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80 animate-pulse rounded-md bg-muted" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>{t("dashboard.chartsLoading")}</CardTitle>
                    <CardDescription>{t("dashboard.chartsLoadingDesc")}</CardDescription>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
