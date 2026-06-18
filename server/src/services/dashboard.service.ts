import { summaryRepository } from "../repositories/summary.repository.js";
import { cacheGet, cacheSet, cacheTTL } from "../cache/cacheService.js";
import { cacheKeys, cacheTags } from "../cache/cacheKeys.js";
import { businessDashboardSummaryRecalculated } from "../observability/businessMetrics.js";

export const dashboardService = {
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
