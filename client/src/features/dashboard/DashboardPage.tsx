import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNumber } from "@/utils/format";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Suspense, lazy, useDeferredValue, useMemo, useState } from "react";
import {
  UserPlus,
  Users,
  FolderOpen,
  CheckSquare,
  Loader2,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Plus,
  CheckCheck,
  Receipt,
  ClipboardList,
  Calendar,
  DollarSign,
  CreditCard,
  Target,
  Zap,
  Shield,
  BarChart3,
  Activity,
  ChevronRight,
  Clock,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDashboardFull } from "@/hooks/useDashboard";
import { useAnalyticsSummary } from "@/hooks/useAnalytics";
import { useExecutiveMetrics } from "@/hooks/useExecutiveMetrics";
import { useCreateLead } from "@/hooks/useLeads";
import { useMe } from "@/hooks/useAuth";
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
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { RiskItem } from "@/types/executiveMetrics";

const DashboardCharts = lazy(() =>
  import("./DashboardCharts").then((m) => ({ default: m.DashboardCharts }))
);

const AnalyticsCharts = lazy(() =>
  import("../analytics/AnalyticsCharts").then((m) => ({ default: m.AnalyticsCharts }))
);

const HealthBoardTab = lazy(() =>
  import("./HealthBoardTab").then((m) => ({ default: m.HealthBoardTab }))
);

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M TND`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K TND`;
  return `${formatNumber(Math.round(n))} TND`;
}

function GrowthBadge({ pct }: { pct: number }) {
  if (pct === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const positive = pct > 0;
  return (
    <span className={`flex items-center text-xs font-semibold ${positive ? "text-emerald-600" : "text-red-500"}`}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {positive ? "+" : ""}{pct}%
    </span>
  );
}

function calculateGrowth(current: number, previous: number) {
  if (previous === 0) return { value: "—", isPositive: false };
  const growth = ((current - previous) / previous) * 100;
  const rounded = Math.round(growth);
  if (rounded > 0) return { value: `+${rounded}%`, isPositive: true };
  if (rounded < 0) return { value: `${rounded}%`, isPositive: false };
  return { value: "0%", isPositive: false };
}

// ─── RiskRow ────────────────────────────────────────────────────────────────

function RiskRow({ item, onClick }: { item: RiskItem; onClick: () => void }) {
  const colorMap = {
    critical: "bg-red-100 text-red-700 border-red-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
  };
  const dotMap = {
    critical: "bg-red-500",
    warning: "bg-amber-500",
    info: "bg-blue-400",
  };
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border text-sm transition-colors hover:opacity-90 ${colorMap[item.severity]}`}
    >
      <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${dotMap[item.severity]}`} />
      <div className="min-w-0">
        <p className="font-medium truncate">{item.title}</p>
        <p className="text-xs opacity-75 truncate">{item.subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 opacity-50" />
    </button>
  );
}

// ─── KPICard ────────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  growth,
  onClick,
  accent = "primary",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  growth?: number;
  onClick?: () => void;
  accent?: "primary" | "green" | "red" | "amber";
}) {
  const accentMap = {
    primary: "bg-primary-soft/40 text-primary",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <Card
      className={`rounded-2xl border border-border shadow-none ${onClick ? "cursor-pointer hover:border-primary/40 transition-colors" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-start justify-between pb-2 pt-5 px-5">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground leading-tight">
          {label}
        </p>
        <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${accentMap[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold text-ink">{value}</p>
          {growth !== undefined && <GrowthBadge pct={growth} />}
        </div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── ExecutiveTab ────────────────────────────────────────────────────────────

function ExecutiveTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: exec, isLoading } = useExecutiveMetrics();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((j) => (
              <Card key={j} className="rounded-2xl border shadow-none">
                <CardContent className="pt-5 px-5 pb-5 space-y-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!exec) return null;

  const { finance, forecast, clients, projects, risks, alerts } = exec;

  const totalAlerts = alerts.overdueInvoices + alerts.pendingApprovals + alerts.criticalProjects;
  const freshAt = new Date(exec.generatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-8">

      {/* ── Data freshness ───────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        {t("exec.dataUpdatedAt", { time: freshAt })}
      </div>

      {/* ── Global alert banner ──────────────────────────────────────── */}
      {totalAlerts > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.overdueInvoices > 0 && (
            <button
              onClick={() => navigate("/app/commercial?tab=invoices")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors"
            >
              <Receipt className="h-3.5 w-3.5" />
              {alerts.overdueInvoices} {t("exec.overdueInvoices")}
            </button>
          )}
          {alerts.pendingApprovals > 0 && (
            <button
              onClick={() => navigate("/app/commercial?tab=approvals")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {alerts.pendingApprovals} {t("exec.pendingApprovals")}
            </button>
          )}
          {alerts.criticalProjects > 0 && (
            <button
              onClick={() => navigate("/app/projects")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors"
            >
              <Zap className="h-3.5 w-3.5" />
              {alerts.criticalProjects} {t("exec.criticalProjects")}
            </button>
          )}
          {alerts.hotLeads > 0 && (
            <button
              onClick={() => navigate("/app/crm")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
            >
              <Target className="h-3.5 w-3.5" />
              {alerts.hotLeads} {t("exec.hotLeads")}
            </button>
          )}
        </div>
      )}

      {/* ── SECTION 1 : Finance ──────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <DollarSign className="h-3.5 w-3.5" />
          {t("exec.sectionFinance")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label={t("exec.cashMTD")}
            value={fmtCurrency(finance.cashMTD)}
            sub={`YTD : ${fmtCurrency(finance.cashYTD)}`}
            icon={DollarSign}
            growth={finance.cashGrowthMoM}
            accent="green"
            onClick={() => navigate("/app/commercial?tab=invoices")}
          />
          <KPICard
            label={t("exec.billedMTD")}
            value={fmtCurrency(finance.billedMTD)}
            sub={`YTD : ${fmtCurrency(finance.billedYTD)}`}
            icon={Receipt}
            accent="primary"
            onClick={() => navigate("/app/commercial?tab=invoices")}
          />
          <KPICard
            label={t("exec.overdueAmount")}
            value={fmtCurrency(finance.overdueAmount)}
            sub={`${finance.overdueCount} ${t("exec.invoices")}`}
            icon={AlertTriangle}
            accent={finance.overdueCount > 0 ? "red" : "green"}
            onClick={() => navigate("/app/commercial?tab=invoices")}
          />
          <KPICard
            label={t("exec.pendingAmount")}
            value={fmtCurrency(finance.pendingAmount)}
            sub={`${finance.pendingCount} ${t("exec.invoices")}`}
            icon={CreditCard}
            accent="amber"
            onClick={() => navigate("/app/commercial?tab=invoices")}
          />
        </div>
      </div>

      {/* ── SECTION 2 : Forecast ─────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5" />
          {t("exec.sectionForecast")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard
            label={t("exec.forecast30")}
            value={fmtCurrency(forecast.next30)}
            icon={TrendingUp}
            accent="green"
          />
          <KPICard
            label={t("exec.forecast60")}
            value={fmtCurrency(forecast.next60)}
            icon={TrendingUp}
            accent="primary"
          />
          <KPICard
            label={t("exec.forecast90")}
            value={fmtCurrency(forecast.next90)}
            icon={TrendingUp}
            accent="primary"
          />
          <KPICard
            label={t("exec.pipeline")}
            value={fmtCurrency(forecast.proposalPipeline)}
            sub={`${t("exec.convRate")} ${forecast.conversionRate}%`}
            icon={Target}
            accent="amber"
            onClick={() => navigate("/app/commercial?tab=proposals")}
          />
          <Card className="rounded-2xl border border-border shadow-none">
            <CardHeader className="pb-2 pt-5 px-5">
              <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                {t("exec.confidence")}
              </p>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-bold text-ink">{forecast.confidenceScore}</span>
                <span className="text-sm text-muted-foreground">/100</span>
              </div>
              <Progress value={forecast.confidenceScore} className="h-1.5" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── SECTION 3 : Clients ──────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Users className="h-3.5 w-3.5" />
          {t("exec.sectionClients")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label={t("exec.activeClients")}
            value={clients.active}
            sub={`${t("exec.total")} : ${clients.total}`}
            icon={Users}
            growth={clients.newGrowthMoM}
            accent="green"
            onClick={() => navigate("/app/clients")}
          />
          <KPICard
            label={t("exec.newClientsMTD")}
            value={clients.newMTD}
            sub={t("exec.thisMonth")}
            icon={UserPlus}
            accent="primary"
            onClick={() => navigate("/app/clients")}
          />
          <KPICard
            label={t("exec.atRiskClients")}
            value={clients.atRisk}
            sub={`${t("exec.champions")} : ${clients.champions}`}
            icon={AlertTriangle}
            accent={clients.atRisk > 0 ? "red" : "green"}
            onClick={() => navigate("/app/clients")}
          />
          <Card className="rounded-2xl border border-border shadow-none">
            <CardHeader className="pb-2 pt-5 px-5">
              <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                {t("exec.retention")}
              </p>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-bold text-ink">{clients.retentionRate}%</span>
              </div>
              <Progress value={clients.retentionRate} className="h-1.5" />
              <p className="text-xs text-muted-foreground mt-2">
                {t("exec.churnRate")} : {clients.churnRate}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Top clients table */}
        {clients.topClients.length > 0 && (
          <Card className="rounded-2xl border border-border shadow-none mt-4">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm font-semibold">{t("exec.topClients")}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="space-y-2">
                {clients.topClients.map((c) => {
                  const healthColor: Record<string, string> = {
                    champion: "text-emerald-600 bg-emerald-50",
                    good: "text-blue-600 bg-blue-50",
                    "at-risk": "text-red-600 bg-red-50",
                    lost: "text-gray-500 bg-gray-100",
                  };
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 px-1 rounded"
                      onClick={() => navigate(`/app/clients/${c.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm text-ink">{c.name}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${healthColor[c.health] ?? ""}`}>
                          {t(`exec.health.${c.health}`, c.health)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{c.projects} {t("exec.projects")}</span>
                        <span className="font-semibold text-ink">{fmtCurrency(c.revenue)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── SECTION 4 : Projects ─────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <FolderOpen className="h-3.5 w-3.5" />
          {t("exec.sectionProjects")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label={t("exec.inProgress")}
            value={projects.inProgress}
            sub={`${t("exec.review")} : ${projects.review}`}
            icon={Activity}
            accent="primary"
            onClick={() => navigate("/app/projects")}
          />
          <KPICard
            label={t("exec.overdueProjects")}
            value={projects.overdue}
            sub={`${t("exec.stale")} : ${projects.stale}`}
            icon={AlertTriangle}
            accent={projects.overdue > 0 ? "red" : "green"}
            onClick={() => navigate("/app/projects")}
          />
          <KPICard
            label={t("exec.criticalProjects")}
            value={projects.criticalCount}
            sub={`${t("exec.watch")} : ${projects.watchCount}`}
            icon={Shield}
            accent={projects.criticalCount > 0 ? "red" : "green"}
            onClick={() => navigate("/app/projects")}
          />
          <Card className="rounded-2xl border border-border shadow-none">
            <CardHeader className="pb-2 pt-5 px-5">
              <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                {t("exec.taskProgress")}
              </p>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-bold text-ink">{projects.tasksDone}</span>
                <span className="text-sm text-muted-foreground">/ {projects.tasksTotal}</span>
              </div>
              <Progress value={projects.tasksTotal ? (projects.tasksDone / projects.tasksTotal) * 100 : 0} className="h-1.5" />
              {projects.tasksOverdue > 0 && (
                <p className="text-xs text-red-500 mt-2">{projects.tasksOverdue} {t("exec.tasksOverdue")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── SECTION 5 : Risks ────────────────────────────────────────── */}
      {risks.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t("exec.sectionRisks")} <span className="text-red-500">({risks.filter(r => r.severity === "critical").length} {t("exec.critical")})</span>
          </h2>
          <div className="space-y-2">
            {risks.slice(0, 10).map((r) => (
              <RiskRow
                key={r.entityId + r.type}
                item={r}
                onClick={() => navigate(r.link)}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useMe();
  const { data: fullDashboard, isLoading: summaryLoading } = useDashboardFull();
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const { mutate: createLead, isPending: isCreatingLead } = useCreateLead();

  const isAdmin = user?.role === "ADMIN";

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

  const deferredDateRange = useDeferredValue(dateRange);

  const { data: analyticsData, isLoading: analyticsLoading } = useAnalyticsSummary(
    deferredDateRange.from,
    deferredDateRange.to
  );

  const taskDonePct = analyticsData?.tasks.taskDonePct ?? 0;
  const overdueCount = analyticsData?.tasks?.overdueCount ?? 0;

  const leadGrowth = useMemo(() => {
    if (!analyticsData?.leads) return { value: "—", isPositive: false };
    return calculateGrowth(analyticsData.leads.conversionRate, analyticsData.leads.previousConversionRate ?? 0);
  }, [analyticsData?.leads]);

  const clientGrowth = useMemo(() => {
    if (!analyticsData?.clients) return { value: "—", isPositive: false };
    return calculateGrowth(analyticsData.clients.newThisMonth, analyticsData.clients.previousNew ?? 0);
  }, [analyticsData?.clients]);

  const projectGrowth = useMemo(() => {
    if (!analyticsData?.projects) return { value: "—", isPositive: false };
    return calculateGrowth(analyticsData.projects.completionRate, analyticsData.projects.previousCompletionRate ?? 0);
  }, [analyticsData?.projects]);

  const taskGrowth = useMemo(() => {
    if (!analyticsData?.tasks) return { value: "—", isPositive: false };
    return calculateGrowth(taskDonePct, analyticsData.tasks.previousTaskDonePct ?? 0);
  }, [analyticsData?.tasks, taskDonePct]);

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const totalLeads = fullDashboard?.totalLeads ?? 0;
  const activeClients = fullDashboard?.activeClients ?? 0;
  const ongoingProjects = fullDashboard?.ongoingProjects ?? 0;
  const completedTasks = fullDashboard?.completedTasks ?? 0;

  const leadsByMonth = analyticsData?.leadsByMonth ?? [];
  const revenueByMonth = analyticsData?.revenueByMonth ?? [];
  const leadsByStatus = analyticsData?.leads?.byStatus ?? [];
  const projectsByStatus = analyticsData?.projectsByStatus ?? [];

  const todayLabel = format(new Date(), "EEE, d MMM yyyy", { locale: fr });
  const firstName = user?.name?.split(" ")[0] ?? "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("dashboard.overview")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {firstName ? t("dashboard.welcomeName", { name: firstName }) : t("dashboard.welcomeAnon")}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-md px-3 py-1.5 bg-surface shrink-0">
          <Calendar className="h-3.5 w-3.5" />
          <span className="capitalize">{todayLabel}</span>
        </div>
      </div>

      {/* Priority Alerts (non-admin fallback) */}
      {!isAdmin && (pendingApprovalsCount > 0 || overdueInvoicesCount > 0 || hotLeadsCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {pendingApprovalsCount > 0 && (
            <button
              onClick={() => navigate("/app/commercial?tab=approvals")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-soft border border-accent/20 text-accent-foreground text-xs font-medium hover:bg-accent/20 transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {pendingApprovalsCount} {t("dashboard.pendingApprovals", { count: pendingApprovalsCount })}
            </button>
          )}
          {overdueInvoicesCount > 0 && (
            <button
              onClick={() => navigate("/app/commercial?tab=invoices")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors"
            >
              <Receipt className="h-3.5 w-3.5" />
              {overdueInvoicesCount} {t("dashboard.overdueInvoices", { count: overdueInvoicesCount })}
            </button>
          )}
          {hotLeadsCount > 0 && (
            <button
              onClick={() => navigate("/app/crm")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-soft border border-primary/20 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {hotLeadsCount} {t("dashboard.hotLeads", { count: hotLeadsCount })}
            </button>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => setNewLeadOpen(true)}
          className="bg-ink text-white rounded-full hover:bg-ink/90 h-9 px-4 text-sm"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          {t("dashboard.newLead")}
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("/app/projects")}
          className="rounded-full h-9 px-4 text-sm"
        >
          <ClipboardList className="h-4 w-4 mr-1.5" />
          {t("dashboard.newTask")}
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("/app/commercial?tab=approvals")}
          className="rounded-full h-9 px-4 text-sm"
        >
          <CheckCheck className="h-4 w-4 mr-1.5" />
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
            <Button
              onClick={handleCreateLead}
              disabled={isCreatingLead || !leadName.trim()}
              className="bg-ink text-white rounded-full hover:bg-ink/90"
            >
              {isCreatingLead && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("dashboard.createAndViewCrm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs defaultValue={isAdmin ? "executive" : "overview"}>
        <TabsList className="bg-transparent border-b border-border rounded-none p-0 h-auto gap-6">
          {isAdmin && (
            <TabsTrigger
              value="executive"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-ink data-[state=active]:text-ink data-[state=active]:shadow-none bg-transparent px-0 pb-2 text-sm font-medium text-muted-foreground"
            >
              {t("dashboard.tabExecutive")}
            </TabsTrigger>
          )}
          <TabsTrigger
            value="overview"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-ink data-[state=active]:text-ink data-[state=active]:shadow-none bg-transparent px-0 pb-2 text-sm font-medium text-muted-foreground"
          >
            {t("dashboard.tabOverview")}
          </TabsTrigger>
          <TabsTrigger
            value="trends"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-ink data-[state=active]:text-ink data-[state=active]:shadow-none bg-transparent px-0 pb-2 text-sm font-medium text-muted-foreground"
          >
            {t("dashboard.tabTrends")}
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger
              value="health"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-ink data-[state=active]:text-ink data-[state=active]:shadow-none bg-transparent px-0 pb-2 text-sm font-medium text-muted-foreground"
            >
              {t("dashboard.tabHealthBoard")}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Executive Tab (ADMIN only) */}
        {isAdmin && (
          <TabsContent value="executive" className="mt-6">
            <ExecutiveTab />
          </TabsContent>
        )}

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t("dashboard.totalLeads"), value: totalLeads, icon: UserPlus },
              { label: t("dashboard.activeClients"), value: activeClients, icon: Users },
              { label: t("dashboard.ongoingProjects"), value: ongoingProjects, icon: FolderOpen },
              { label: t("dashboard.completedTasks"), value: completedTasks, icon: CheckSquare },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="rounded-2xl border border-border shadow-none">
                <CardHeader className="flex flex-row items-start justify-between pb-3 pt-5 px-5">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                    {label}
                  </p>
                  <div className="h-8 w-8 rounded-xl bg-primary-soft/40 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <p className="text-3xl font-bold text-ink">{value}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="h-1.5 w-16 rounded-full bg-muted" />
                    <span className="text-xs text-muted-foreground">{t("dashboard.fromLastMonth")}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Suspense
            fallback={
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <Card key={i} className="rounded-2xl border border-border shadow-none">
                    <CardContent className="pt-6">
                      <div className="h-72 animate-pulse rounded-xl bg-muted" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            }
          >
            <DashboardCharts leadsByMonth={leadsByMonth} leadsByStatus={leadsByStatus} />
          </Suspense>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6 mt-6">
          <div className="flex justify-end">
            <DateFilter value={dateRange} onChange={setDateRange} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: t("dashboard.leadConversion"),
                icon: TrendingUp,
                value: analyticsData ? `${analyticsData.leads.conversionRate ?? 0}%` : null,
                growth: leadGrowth,
                sub: `${analyticsData?.leads.wonCount ?? 0} ${t("dashboard.leadsConverted")}`,
              },
              {
                label: t("dashboard.activeClientsCard"),
                icon: Users,
                value: analyticsData ? `${analyticsData.clients.total ?? 0}` : null,
                growth: clientGrowth,
                sub: `${analyticsData?.clients.newThisMonth ?? 0} ${t("dashboard.thisMonth")}`,
              },
              {
                label: t("dashboard.projectCompletion"),
                icon: CheckCircle2,
                value: analyticsData ? `${analyticsData.projects.completionRate ?? 0}%` : null,
                growth: projectGrowth,
                sub: `${analyticsData?.projects.completedCount ?? 0} ${t("dashboard.projectsCount")}`,
              },
              {
                label: t("dashboard.tasksDone"),
                icon: CheckCircle2,
                value: analyticsData ? `${taskDonePct}%` : null,
                growth: taskGrowth,
                sub: overdueCount > 0 ? `${overdueCount} ${t("dashboard.overdueCount")}` : t("dashboard.noOverdue"),
              },
            ].map(({ label, icon: Icon, value, growth, sub }) => (
              <Card key={label} className="rounded-2xl border border-border shadow-none">
                <CardHeader className="flex flex-row items-start justify-between pb-3 pt-5 px-5">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                    {label}
                  </p>
                  <div className="h-8 w-8 rounded-xl bg-primary-soft/40 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  {analyticsLoading || value === null ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-ink">{value}</span>
                        <span className={`flex items-center text-xs font-medium ${growth.isPositive ? "text-green-600" : "text-muted-foreground"}`}>
                          {growth.isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                          {growth.value}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Suspense
            fallback={
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <Card key={i} className="rounded-2xl border border-border shadow-none">
                    <CardContent className="pt-6">
                      <div className="h-72 animate-pulse rounded-xl bg-muted" />
                    </CardContent>
                  </Card>
                ))}
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

        {/* Health Board Tab */}
        {isAdmin && (
          <TabsContent value="health" className="space-y-4 mt-6">
            <Suspense fallback={<div className="h-60 animate-pulse bg-muted rounded-2xl" />}>
              <HealthBoardTab />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
