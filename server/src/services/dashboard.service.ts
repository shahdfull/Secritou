import { prismaRead as prisma } from "../config/prisma.js";
import { cacheGet, cacheSet, cacheTTL } from "../cache/cacheService.js";
import { cacheKeys, cacheTags } from "../cache/cacheKeys.js";
import { businessDashboardSummaryRecalculated } from "../observability/businessMetrics.js";

export const dashboardService = {
  async getSummary(companyId: string) {
    const cacheKey = cacheKeys.dashboardSummary(companyId);
    const cached = await cacheGet<Awaited<ReturnType<typeof dashboardService.computeSummary>>>(cacheKey);
    if (cached) return cached;

    const summary = await this.computeSummary(companyId);
    await cacheSet(cacheKey, summary, cacheTTL.dashboard, [
      cacheTags.dashboard(companyId),
      cacheTags.company(companyId),
    ]);
    return summary;
  },

  async computeSummary(companyId: string) {
    const [totalLeads, activeClients, ongoingProjects, projects] = await Promise.all([
      prisma.lead.count({ where: { companyId, archivedAt: null } }),
      prisma.client.count({ where: { companyId } }),
      prisma.project.count({ where: { companyId, status: { not: "COMPLETED" } } }),
      prisma.project.findMany({
        where: { companyId },
        select: {
          id: true,
          tasks: {
            where: { status: "DONE" },
            select: { id: true },
          },
        },
      }),
    ]);

    const completedTasks = projects.reduce((sum, project) => sum + project.tasks.length, 0);

    return {
      totalLeads,
      activeClients,
      ongoingProjects,
      completedTasks,
    };
  },

  async warmSummary(companyId: string) {
    const summary = await this.computeSummary(companyId);
    await cacheSet(cacheKeys.dashboardSummary(companyId), summary, cacheTTL.dashboard, [
      cacheTags.dashboard(companyId),
      cacheTags.company(companyId),
    ]);
    businessDashboardSummaryRecalculated.inc({ company: companyId });
    return summary;
  },

  async warmAllSummaries() {
    const companies = await prisma.company.findMany({
      select: { id: true },
    });

    for (const company of companies) {
      await this.warmSummary(company.id);
    }

    return companies.length;
  },
};
