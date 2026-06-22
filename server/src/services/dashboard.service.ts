import { summaryRepository } from "../repositories/summary.repository.js";
import { COMPANY_ID } from "../config/constants.js";
import { prismaRead } from "../config/prisma.js";
import { cacheGet, cacheSet, cacheTTL } from "../cache/cacheService.js";
import { cacheKeys, cacheTags } from "../cache/cacheKeys.js";
import { businessDashboardSummaryRecalculated } from "../observability/businessMetrics.js";

export const dashboardService = {
  async getFullDashboard() {
    const [summary, pendingApprovals, overdueInvoices, hotLeads] = await Promise.all([
      this.getSummary(),
      prismaRead.approval.count({ where: { companyId: COMPANY_ID, status: "PENDING" } }),
      // Computed at read time so the dashboard is correct even between the daily overdue job
      // runs: any SENT/PARTIAL/OVERDUE invoice whose dueDate has passed counts as overdue.
      prismaRead.invoice.count({
        where: {
          companyId: COMPANY_ID,
          status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
          dueDate: { lt: new Date() },
        },
      }),
      prismaRead.lead.count({ where: { companyId: COMPANY_ID, status: "QUALIFIED", archivedAt: null } }),
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

  async getSummary() {
    const cacheKey = cacheKeys.dashboardSummary();
    const cached = await cacheGet<Awaited<ReturnType<typeof summaryRepository.getEnhancedDashboardSummary>>>(cacheKey);
    if (cached) return cached;

    const summary = await summaryRepository.getEnhancedDashboardSummary(COMPANY_ID);
    await cacheSet(cacheKey, summary, cacheTTL.dashboard, [
      cacheTags.dashboard(),
      cacheTags.company(),
    ]);
    return summary;
  },

  async warmSummary() {
    const summary = await summaryRepository.getEnhancedDashboardSummary(COMPANY_ID);
    await cacheSet(cacheKeys.dashboardSummary(), summary, cacheTTL.dashboard, [
      cacheTags.dashboard(),
      cacheTags.company(),
    ]);
    businessDashboardSummaryRecalculated.inc({ company: COMPANY_ID });
    return summary;
  },

  async warmAllSummaries() {
    const { prismaRead: prisma } = await import("../config/prisma.js");
    const companies = await prisma.company.findMany({
      select: { id: true },
    });

    for (const company of companies) {
      const summary = await summaryRepository.getEnhancedDashboardSummary(company.id);
      await cacheSet(cacheKeys.dashboardSummary(company.id), summary, cacheTTL.dashboard, [
        cacheTags.dashboard(company.id),
        cacheTags.company(company.id),
      ]);
      businessDashboardSummaryRecalculated.inc({ company: company.id });
    }

    return companies.length;
  },
};
