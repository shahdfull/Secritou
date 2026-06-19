import { summaryRepository } from "../repositories/summary.repository.js";
import { prismaRead } from "../config/prisma.js";
import { cacheGet, cacheSet, cacheTTL } from "../cache/cacheService.js";
import { cacheKeys, cacheTags } from "../cache/cacheKeys.js";
import { businessDashboardSummaryRecalculated } from "../observability/businessMetrics.js";

export const dashboardService = {
  async getFullDashboard(companyId: string) {
    const [summary, pendingApprovals, overdueInvoices, hotLeads] = await Promise.all([
      this.getSummary(companyId),
      prismaRead.approval.count({ where: { companyId, status: "PENDING" } }),
      // Computed at read time so the dashboard is correct even between the daily overdue job
      // runs: any SENT/PARTIAL/OVERDUE invoice whose dueDate has passed counts as overdue.
      prismaRead.invoice.count({
        where: {
          companyId,
          status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
          dueDate: { lt: new Date() },
        },
      }),
      prismaRead.lead.count({ where: { companyId, status: "QUALIFIED", archivedAt: null } }),
    ]);

    return {
      ...summary,
      // Derived convenience fields used in the dashboard
      totalLeads: Object.values(summary.leads as Record<string, number>).reduce((a, b) => a + b, 0),
      activeClients: (summary.clients as { total: number }).total,
      ongoingProjects: (summary.projects as Record<string, number>)["IN_PROGRESS"] ?? 0,
      completedTasks: (summary.tasks as Record<string, number>)["DONE"] ?? 0,
      // Alert counts
      pendingApprovalsCount: pendingApprovals,
      overdueInvoicesCount: overdueInvoices,
      hotLeadsCount: hotLeads,
    };
  },

  async getSummary(companyId: string) {
    const cacheKey = cacheKeys.dashboardSummary(companyId);
    const cached = await cacheGet<Awaited<ReturnType<typeof summaryRepository.getEnhancedDashboardSummary>>>(cacheKey);
    if (cached) return cached;

    const summary = await summaryRepository.getEnhancedDashboardSummary(companyId);
    await cacheSet(cacheKey, summary, cacheTTL.dashboard, [
      cacheTags.dashboard(companyId),
      cacheTags.company(companyId),
    ]);
    return summary;
  },

  async warmSummary(companyId: string) {
    const summary = await summaryRepository.getEnhancedDashboardSummary(companyId);
    await cacheSet(cacheKeys.dashboardSummary(companyId), summary, cacheTTL.dashboard, [
      cacheTags.dashboard(companyId),
      cacheTags.company(companyId),
    ]);
    businessDashboardSummaryRecalculated.inc({ company: companyId });
    return summary;
  },

  async warmAllSummaries() {
    const { prismaRead: prisma } = await import("../config/prisma.js");
    const companies = await prisma.company.findMany({
      select: { id: true },
    });

    for (const company of companies) {
      await this.warmSummary(company.id);
    }

    return companies.length;
  },
};
