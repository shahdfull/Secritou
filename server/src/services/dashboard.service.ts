import { summaryRepository } from "../repositories/summary.repository.js";
import { prismaRead } from "../config/prisma.js";
import { cacheGet, cacheSet, cacheTTL } from "../cache/cacheService.js";
import { cacheKeys, cacheTags } from "../cache/cacheKeys.js";
import { businessDashboardSummaryRecalculated } from "../observability/businessMetrics.js";

export const dashboardService = {
  async getFullDashboard() {
    const [summary, pendingApprovals, overdueInvoices, hotLeads] = await Promise.all([
      this.getSummary(),
      prismaRead.approval.count({ where: { status: "PENDING" } }),
      // Computed at read time so the dashboard is correct even between the daily overdue job runs.
      prismaRead.invoice.count({ where: { status: { in: ["SENT", "PARTIAL", "OVERDUE"] }, dueDate: { lt: new Date() } } }),
      prismaRead.lead.count({ where: { status: "QUALIFIED", archivedAt: null } }),
    ]);

    return {
      ...summary,
      totalLeads: Object.values(summary.leads as Record<string, number>).reduce((a, b) => a + b, 0),
      activeClients: (summary.clients as { total: number }).total,
      ongoingProjects: (summary.projects as Record<string, number>)["IN_PROGRESS"] ?? 0,
      completedTasks: (summary.tasks as Record<string, number>)["DONE"] ?? 0,
      pendingApprovalsCount: pendingApprovals,
      overdueInvoicesCount: overdueInvoices,
      hotLeadsCount: hotLeads,
    };
  },

  async getSummary() {
    const cacheKey = cacheKeys.dashboardSummary();
    const cached = await cacheGet<Awaited<ReturnType<typeof summaryRepository.getEnhancedDashboardSummary>>>(cacheKey);
    if (cached) return cached;

    const summary = await summaryRepository.getEnhancedDashboardSummary();
    await cacheSet(cacheKey, summary, cacheTTL.dashboard, [cacheTags.dashboard(), cacheTags.company()]);
    return summary;
  },

  async warmSummary() {
    const summary = await summaryRepository.getEnhancedDashboardSummary();
    await cacheSet(cacheKeys.dashboardSummary(), summary, cacheTTL.dashboard, [cacheTags.dashboard(), cacheTags.company()]);
    businessDashboardSummaryRecalculated.inc({ company: "secritou" });
    return summary;
  },

  async warmAllSummaries() {
    await this.warmSummary();
    return 1;
  },
};
