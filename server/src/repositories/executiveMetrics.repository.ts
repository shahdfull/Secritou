/**
 * Executive Metrics Repository — Single Source of Truth for all KPIs.
 *
 * All dashboard KPIs flow through this file. No other repository should
 * recompute revenue, cash, client health, or project risk — call this one.
 */
import { prismaRead as prisma } from "../config/prisma.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function startOf(unit: "month" | "year", ref = new Date()): Date {
  const d = new Date(ref);
  if (unit === "year") {
    d.setMonth(0, 1); d.setHours(0, 0, 0, 0); return d;
  }
  d.setDate(1); d.setHours(0, 0, 0, 0); return d;
}

function pct(num: number, den: number) {
  return den === 0 ? 0 : Math.round((num / den) * 100);
}

function growthPct(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── types ───────────────────────────────────────────────────────────────────

export interface FinanceKPIs {
  // Cash actually received (sum of payments)
  cashMTD: number;
  cashYTD: number;
  cashTotal: number;
  // Revenue billed (invoices confirmed, not DRAFT/CANCELLED)
  billedMTD: number;
  billedYTD: number;
  billedTotal: number;
  // Outstanding
  overdueAmount: number;
  overdueCount: number;
  pendingAmount: number;  // SENT + PARTIAL not yet overdue
  pendingCount: number;
  // Growth
  cashGrowthMoM: number;   // % vs previous month
  cashGrowthYoY: number;   // % vs same month last year
  // Monthly series (last 12 months, for sparkline)
  cashByMonth: Array<{ month: string; cash: number; billed: number }>;
}

export interface ForecastKPIs {
  next30: number;
  next60: number;
  next90: number;
  overdueCarryover: number;
  proposalPipeline: number;   // total SENT+VIEWED proposals amount
  conversionRate: number;     // historical: won proposals / total sent
  confidenceScore: number;    // 0-100 synthetic score
}

export interface ClientKPIs {
  total: number;
  active: number;           // has at least 1 IN_PROGRESS or REVIEW project
  newMTD: number;
  newGrowthMoM: number;
  atRisk: number;           // overdue invoice > 30 days
  lost: number;             // no active project + last completed > 6 months
  champions: number;        // ≥ 2 completed projects
  churnRate: number;        // lost / (total - new) %
  retentionRate: number;    // 100 - churnRate
  topClients: Array<{
    id: string; name: string;
    revenue: number; projects: number; health: string;
  }>;
}

export interface ProjectKPIs {
  total: number;
  planning: number;
  inProgress: number;
  review: number;
  completed: number;
  overdue: number;          // deadline passed, not completed
  stale: number;            // no task activity > 7 days, IN_PROGRESS
  blocked: number;          // tasks in REVIEW > 3 days
  criticalCount: number;    // red health score
  watchCount: number;       // orange health score
  completionRate: number;   // completed / total %
  avgDurationDays: number;  // mean days createdAt → clientApprovedAt for COMPLETED
  tasksDone: number;
  tasksTotal: number;
  tasksOverdue: number;
}

export interface RiskItem {
  type: "INVOICE_OVERDUE" | "APPROVAL_BLOCKED" | "PROJECT_CRITICAL" | "CONTRACT_EXPIRING" | "STALE_PROJECT" | "LEAD_HOT";
  severity: "critical" | "warning" | "info";
  title: string;
  subtitle: string;
  link: string;
  entityId: string;
  daysAgo?: number;
}

export interface ExecutiveMetrics {
  generatedAt: string;        // ISO timestamp — data freshness signal
  finance: FinanceKPIs;
  forecast: ForecastKPIs;
  clients: ClientKPIs;
  projects: ProjectKPIs;
  risks: RiskItem[];
  // Quick-action counts (for alert badges)
  alerts: {
    overdueInvoices: number;
    pendingApprovals: number;
    criticalProjects: number;
    hotLeads: number;
    expiringContracts: number;
  };
}

// ─── repository ──────────────────────────────────────────────────────────────

export const executiveMetricsRepository = {
  async getAll(): Promise<ExecutiveMetrics> {
    const now = new Date();
    const mtdStart = startOf("month", now);
    const ytdStart = startOf("year", now);
    const prevMtdStart = new Date(mtdStart); prevMtdStart.setMonth(prevMtdStart.getMonth() - 1);
    const prevMtdEnd = new Date(mtdStart.getTime() - 1);
    const sameMthLastYear = new Date(mtdStart); sameMthLastYear.setFullYear(sameMthLastYear.getFullYear() - 1);
    const sameMthLastYearEnd = new Date(mtdStart); sameMthLastYearEnd.setFullYear(sameMthLastYearEnd.getFullYear() - 1); sameMthLastYearEnd.setMonth(sameMthLastYearEnd.getMonth() + 1);
    const day7ago = new Date(now.getTime() - 7 * 86_400_000);
    const day30ago = new Date(now.getTime() - 30 * 86_400_000);
    const day90ago = new Date(now.getTime() - 90 * 86_400_000);
    const day3ago = new Date(now.getTime() - 3 * 86_400_000);
    const in30 = new Date(now.getTime() + 30 * 86_400_000);
    const in60 = new Date(now.getTime() + 60 * 86_400_000);
    const in90 = new Date(now.getTime() + 90 * 86_400_000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 86_400_000);

    // Run all queries in parallel for maximum throughput
    const [
      // Finance
      cashMTDRaw,
      cashYTDRaw,
      cashTotalRaw,
      cashPrevMtdRaw,
      cashSameMonthLastYearRaw,
      billedMTDRaw,
      billedYTDRaw,
      billedTotalRaw,
      overdueRaw,
      pendingRaw,
      cashByMonthRaw,
      billedByMonthRaw,

      // Forecast
      forecastInvoices30,
      forecastInvoices60,
      forecastInvoices90,
      proposalPipelineRaw,
      proposalWonRaw,
      proposalSentRaw,

      // Clients
      clientsAll,
      clientsNewMTD,
      clientsNewPrevMTD,
      clientsWithProjects,

      // Projects
      projectStatusCounts,
      projectsOverdue,
      projectsStale,
      projectsBlocked,
      projectsCompletedDuration,

      // Tasks
      taskTotal,
      taskDone,
      taskOverdue,

      // Risks raw data
      overdueInvoicesFull,
      pendingApprovals,
      hotLeads,
      expiringApprovals,

    ] = await Promise.all([
      // ── Finance ──
      prisma.payment.aggregate({ where: { paidAt: { gte: mtdStart } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { paidAt: { gte: ytdStart } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { paidAt: { gte: prevMtdStart, lte: prevMtdEnd } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { paidAt: { gte: sameMthLastYear, lt: sameMthLastYearEnd } }, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { status: { notIn: ["DRAFT", "CANCELLED"] }, createdAt: { gte: mtdStart } }, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { status: { notIn: ["DRAFT", "CANCELLED"] }, createdAt: { gte: ytdStart } }, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { status: { notIn: ["DRAFT", "CANCELLED"] } }, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { status: { in: ["SENT", "PARTIAL", "OVERDUE"] }, dueDate: { lt: now } }, _sum: { amount: true }, _count: true }),
      prisma.invoice.aggregate({ where: { status: { in: ["SENT", "PARTIAL"] }, dueDate: { gte: now } }, _sum: { amount: true }, _count: true }),
      // Monthly cash + billed (last 12 months)
      prisma.payment.findMany({
        where: { paidAt: { gte: new Date(ytdStart.getFullYear() - 1, ytdStart.getMonth(), 1) } },
        select: { paidAt: true, amount: true },
      }),
      prisma.invoice.findMany({
        where: {
          status: { notIn: ["DRAFT", "CANCELLED"] },
          createdAt: { gte: new Date(ytdStart.getFullYear() - 1, ytdStart.getMonth(), 1) },
        },
        select: { createdAt: true, amount: true },
      }),

      // ── Forecast ──
      prisma.invoice.aggregate({ where: { status: { in: ["SENT", "PARTIAL"] }, dueDate: { gte: now, lte: in30 } }, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { status: { in: ["SENT", "PARTIAL"] }, dueDate: { gte: now, lte: in60 } }, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { status: { in: ["SENT", "PARTIAL"] }, dueDate: { gte: now, lte: in90 } }, _sum: { amount: true } }),
      prisma.proposal.aggregate({ where: { status: { in: ["SENT", "VIEWED"] } }, _sum: { amount: true } }),
      prisma.proposal.count({ where: { status: "ACCEPTED", createdAt: { gte: day90ago } } }),
      prisma.proposal.count({ where: { status: { in: ["SENT", "VIEWED", "ACCEPTED", "REJECTED"] }, createdAt: { gte: day90ago } } }),

      // ── Clients ──
      prisma.client.count(),
      prisma.client.count({ where: { createdAt: { gte: mtdStart } } }),
      prisma.client.count({ where: { createdAt: { gte: prevMtdStart, lte: prevMtdEnd } } }),
      prisma.client.findMany({
        select: {
          id: true, name: true, createdAt: true,
          // Project-less invoices (projectId null) are fetched at client level so
          // health/revenue see every confirmed invoice, not only project-linked ones.
          invoices: { where: { projectId: null, status: { notIn: ["DRAFT", "CANCELLED"] } }, select: { amount: true, amountPaid: true, status: true, dueDate: true } },
          projects: {
            select: {
              id: true, status: true, clientApprovedAt: true, createdAt: true,
              invoices: { where: { status: { notIn: ["DRAFT", "CANCELLED"] } }, select: { amount: true, amountPaid: true, status: true, dueDate: true } },
            },
          },
        },
      }),

      // ── Projects ──
      prisma.project.groupBy({ by: ["status"], _count: true, orderBy: { status: "asc" } }),
      prisma.project.count({ where: { deadline: { lt: now }, status: { notIn: ["COMPLETED"] } } }),
      // `every` is vacuously true on empty lists, so require at least one task:
      // a project with no tasks yet is "not started", not stale.
      prisma.project.count({
        where: {
          status: "IN_PROGRESS",
          tasks: { some: {}, every: { updatedAt: { lt: day7ago } } },
        },
      }),
      // Blocked = has tasks in REVIEW for > 3 days
      prisma.project.count({
        where: {
          tasks: { some: { status: "REVIEW", updatedAt: { lt: day3ago } } },
        },
      }),
      prisma.project.findMany({
        where: { status: "COMPLETED", clientApprovedAt: { not: null } },
        select: { createdAt: true, clientApprovedAt: true },
      }),

      // ── Tasks ──
      prisma.task.count(),
      prisma.task.count({ where: { status: "DONE" } }),
      prisma.task.count({ where: { dueDate: { lt: now }, status: { not: "DONE" } } }),

      // ── Risks ──
      prisma.invoice.findMany({
        where: { status: { in: ["SENT", "PARTIAL", "OVERDUE"] }, dueDate: { lt: now } },
        select: { id: true, number: true, amount: true, dueDate: true, client: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
        take: 10,
      }),
      prisma.approval.findMany({
        where: { status: "PENDING", createdAt: { lt: day3ago } },
        select: { id: true, title: true, createdAt: true, client: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
      prisma.lead.findMany({
        where: { status: { in: ["QUALIFIED", "PROPOSAL"] }, archivedAt: null },
        select: { id: true, name: true, status: true, createdAt: true },
        take: 5,
      }),
      prisma.approval.findMany({
        where: { status: "PENDING", dueDate: { gte: now, lte: in30 } },
        select: { id: true, title: true, dueDate: true },
        take: 5,
      }),
    ]);

    // ── Finance computation ────────────────────────────────────────────────
    const cashMTD = Number(cashMTDRaw._sum.amount ?? 0);
    const cashYTD = Number(cashYTDRaw._sum.amount ?? 0);
    const cashTotal = Number(cashTotalRaw._sum.amount ?? 0);
    const cashPrevMTD = Number(cashPrevMtdRaw._sum.amount ?? 0);
    const cashSameMthLY = Number(cashSameMonthLastYearRaw._sum.amount ?? 0);

    // Build monthly series (last 13 months)
    const monthMap = new Map<string, { cash: number; billed: number }>();
    for (const p of cashByMonthRaw) {
      if (!p.paidAt) continue;
      const key = `${p.paidAt.getFullYear()}-${String(p.paidAt.getMonth() + 1).padStart(2, "0")}`;
      const cur = monthMap.get(key) ?? { cash: 0, billed: 0 };
      monthMap.set(key, { ...cur, cash: cur.cash + Number(p.amount ?? 0) });
    }
    for (const inv of billedByMonthRaw) {
      const key = `${inv.createdAt.getFullYear()}-${String(inv.createdAt.getMonth() + 1).padStart(2, "0")}`;
      const cur = monthMap.get(key) ?? { cash: 0, billed: 0 };
      monthMap.set(key, { ...cur, billed: cur.billed + Number(inv.amount ?? 0) });
    }
    const cashByMonth = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, v]) => {
        const [y, m] = key.split("-");
        const label = new Date(Number(y), Number(m) - 1, 1).toLocaleString("fr-FR", { month: "short", year: "2-digit" });
        return { month: label, cash: Math.round(v.cash), billed: Math.round(v.billed) };
      });

    const finance: FinanceKPIs = {
      cashMTD, cashYTD, cashTotal,
      billedMTD: Number(billedMTDRaw._sum.amount ?? 0),
      billedYTD: Number(billedYTDRaw._sum.amount ?? 0),
      billedTotal: Number(billedTotalRaw._sum.amount ?? 0),
      overdueAmount: Number(overdueRaw._sum.amount ?? 0),
      overdueCount: overdueRaw._count,
      pendingAmount: Number(pendingRaw._sum.amount ?? 0),
      pendingCount: pendingRaw._count,
      cashGrowthMoM: growthPct(cashMTD, cashPrevMTD),
      cashGrowthYoY: growthPct(cashMTD, cashSameMthLY),
      cashByMonth,
    };

    // ── Forecast computation ───────────────────────────────────────────────
    // Without proposal history there is no basis for a conversion rate: report 0
    // and keep the forecast to invoices actually due, rather than fabricating
    // pipeline revenue from a made-up percentage.
    const pipeline = Number(proposalPipelineRaw._sum.amount ?? 0);
    const convRate = proposalSentRaw === 0 ? 0 : pct(proposalWonRaw, proposalSentRaw);
    const CONV = convRate / 100;

    const f30 = Number(forecastInvoices30._sum.amount ?? 0) + pipeline * CONV * 0.33;
    const f60 = Number(forecastInvoices60._sum.amount ?? 0) + pipeline * CONV * 0.66;
    const f90 = Number(forecastInvoices90._sum.amount ?? 0) + pipeline * CONV;

    // Confidence: higher when pipeline is large vs overdue, lower when many overdue
    const overduePct = finance.billedTotal > 0 ? (finance.overdueAmount / finance.billedTotal) * 100 : 0;
    const confidenceScore = Math.max(20, Math.min(95, Math.round(80 - overduePct * 0.5 + (convRate > 30 ? 10 : 0))));

    const forecast: ForecastKPIs = {
      next30: Math.round(f30),
      next60: Math.round(f60),
      next90: Math.round(f90),
      overdueCarryover: finance.overdueAmount,
      proposalPipeline: pipeline,
      conversionRate: convRate,
      confidenceScore,
    };

    // ── Client KPIs ────────────────────────────────────────────────────────
    // atRisk (financial health) and lost (activity) are independent axes: a
    // client can be both. The displayed `health` badge keeps a single value
    // with at-risk taking priority, but the counters no longer mask each other,
    // so churnRate reflects every lost client even when they also have overdue
    // invoices.
    let atRisk = 0, lost = 0, champions = 0, activeClients = 0;
    const topClientsMap: Array<{ id: string; name: string; revenue: number; projects: number; health: string }> = [];

    for (const c of clientsWithProjects) {
      const hasActive = c.projects.some(p => ["IN_PROGRESS", "REVIEW", "PLANNING"].includes(p.status));
      const completedProjects = c.projects.filter(p => p.status === "COMPLETED");
      const lastCompleted = completedProjects.reduce<Date | null>((acc, p) => {
        const d = p.clientApprovedAt ?? p.createdAt;
        return !acc || d > acc ? d : acc;
      }, null);
      const allInvoices = [...c.invoices, ...c.projects.flatMap(p => p.invoices)];
      const hasOverdue30 = allInvoices.some(i => ["SENT", "PARTIAL", "OVERDUE"].includes(i.status) && i.dueDate && i.dueDate < day30ago);
      const totalRevenue = allInvoices.reduce((s, i) => s + Number(i.amountPaid ?? 0), 0);
      const isLost = !hasActive && lastCompleted !== null && lastCompleted < sixMonthsAgo;

      if (hasActive) activeClients++;
      if (hasOverdue30) atRisk++;
      if (isLost) lost++;
      else if (completedProjects.length >= 2) champions++;

      const health = hasOverdue30 ? "at-risk" : isLost ? "lost" : completedProjects.length >= 2 ? "champion" : "good";
      topClientsMap.push({ id: c.id, name: c.name, revenue: totalRevenue, projects: c.projects.length, health });
    }

    const topClients = topClientsMap.sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const churnRate = clientsAll > clientsNewMTD ? pct(lost, clientsAll - clientsNewMTD) : 0;

    const clients: ClientKPIs = {
      total: clientsAll,
      active: activeClients,
      newMTD: clientsNewMTD,
      newGrowthMoM: growthPct(clientsNewMTD, clientsNewPrevMTD),
      atRisk,
      lost,
      champions,
      churnRate,
      retentionRate: Math.max(0, 100 - churnRate),
      topClients,
    };

    // ── Project KPIs ───────────────────────────────────────────────────────
    const statusMap: Record<string, number> = {};
    for (const r of projectStatusCounts) statusMap[r.status] = r._count;
    const totalProjects = Object.values(statusMap).reduce((s, n) => s + n, 0);

    // Health scoring for each active project (simplified version for counts)
    const activeProjects = await prisma.project.findMany({
      where: { status: { notIn: ["COMPLETED"] } },
      select: {
        id: true, status: true, deadline: true,
        tasks: { select: { status: true, updatedAt: true } },
      },
    });

    let criticalCount = 0, watchCount = 0;
    for (const p of activeProjects) {
      const isOverdue = p.deadline ? p.deadline < now : false;
      const lastActivity = p.tasks.reduce<Date | null>((acc, t) => !acc || t.updatedAt > acc ? t.updatedAt : acc, null);
      // A project with no tasks is "not started", never stale/critical on that basis.
      const isStale = lastActivity ? lastActivity < day7ago : false;
      const blockedTasks = p.tasks.filter(t => t.status === "REVIEW" && t.updatedAt < day3ago).length;
      const daysUntilDeadline = p.deadline ? Math.ceil((p.deadline.getTime() - now.getTime()) / 86_400_000) : null;
      const isWarnDeadline = daysUntilDeadline !== null && daysUntilDeadline <= 7 && daysUntilDeadline >= 0;

      if (isOverdue || isStale || blockedTasks > 2) criticalCount++;
      else if (isWarnDeadline || blockedTasks > 0 || (lastActivity && lastActivity < new Date(now.getTime() - 4 * 86_400_000))) watchCount++;
    }

    const completedDurations = projectsCompletedDuration
      .filter(p => p.clientApprovedAt)
      .map(p => Math.ceil((p.clientApprovedAt!.getTime() - p.createdAt.getTime()) / 86_400_000));
    const avgDurationDays = completedDurations.length
      ? Math.round(completedDurations.reduce((s, d) => s + d, 0) / completedDurations.length)
      : 0;

    const projects: ProjectKPIs = {
      total: totalProjects,
      planning: statusMap["PLANNING"] ?? 0,
      inProgress: statusMap["IN_PROGRESS"] ?? 0,
      review: statusMap["REVIEW"] ?? 0,
      completed: statusMap["COMPLETED"] ?? 0,
      overdue: projectsOverdue,
      stale: projectsStale,
      blocked: projectsBlocked,
      criticalCount,
      watchCount,
      completionRate: pct(statusMap["COMPLETED"] ?? 0, totalProjects),
      avgDurationDays,
      tasksDone: taskDone,
      tasksTotal: taskTotal,
      tasksOverdue: taskOverdue,
    };

    // ── Risks ──────────────────────────────────────────────────────────────
    const risks: RiskItem[] = [];

    for (const inv of overdueInvoicesFull) {
      const daysAgo = inv.dueDate ? Math.ceil((now.getTime() - inv.dueDate.getTime()) / 86_400_000) : 0;
      risks.push({
        type: "INVOICE_OVERDUE",
        severity: daysAgo > 30 ? "critical" : "warning",
        title: `Facture ${inv.number} impayée`,
        subtitle: `${inv.client?.name ?? "?"} — ${Number(inv.amount ?? 0).toLocaleString("fr-FR")} TND — ${daysAgo}j de retard`,
        link: "/app/commercial?tab=invoices",
        entityId: inv.id,
        daysAgo,
      });
    }

    for (const appr of pendingApprovals) {
      const daysAgo = Math.ceil((now.getTime() - appr.createdAt.getTime()) / 86_400_000);
      risks.push({
        type: "APPROVAL_BLOCKED",
        severity: daysAgo > 7 ? "critical" : "warning",
        title: `Approbation bloquée`,
        subtitle: `${appr.client?.name ?? "?"} — "${appr.title}" — ${daysAgo}j en attente`,
        link: "/app/commercial?tab=approvals",
        entityId: appr.id,
        daysAgo,
      });
    }

    for (const lead of hotLeads) {
      risks.push({
        type: "LEAD_HOT",
        severity: "info",
        title: `Lead qualifié à traiter`,
        subtitle: `${lead.name} — statut ${lead.status}`,
        link: "/app/crm",
        entityId: lead.id,
      });
    }

    // Sort: critical first, then warning, then info
    risks.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });

    return {
      generatedAt: now.toISOString(),
      finance,
      forecast,
      clients,
      projects,
      risks: risks.slice(0, 20),
      alerts: {
        overdueInvoices: finance.overdueCount,
        pendingApprovals: pendingApprovals.length,
        criticalProjects: criticalCount,
        hotLeads: hotLeads.length,
        expiringContracts: expiringApprovals.length,
      },
    };
  },
};
