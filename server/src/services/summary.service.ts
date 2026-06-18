import { summaryRepository } from "../repositories/summary.repository.js";
import { cacheGet, cacheSet, cacheTTL } from "../cache/cacheService.js";
import { cacheKeys, cacheTags } from "../cache/cacheKeys.js";

export const summaryService = {
  async getClientSummary(companyId: string, clientId: string) {
    const cacheKey = cacheKeys.clientSummary(companyId, clientId);
    const cached = await cacheGet<Awaited<ReturnType<typeof summaryRepository.getClientSummary>>>(cacheKey);
    if (cached) return cached;

    const summary = await summaryRepository.getClientSummary(companyId, clientId);
    if (summary) {
      await cacheSet(cacheKey, summary, cacheTTL.clientSummary, [
        cacheTags.client(companyId, clientId),
        cacheTags.company(companyId),
      ]);
    }

    return summary;
  },

  async getProjectSummary(companyId: string, projectId: string) {
    const cacheKey = cacheKeys.projectSummary(companyId, projectId);
    const cached = await cacheGet<Awaited<ReturnType<typeof summaryRepository.getProjectSummary>>>(cacheKey);
    if (cached) return cached;

    const summary = await summaryRepository.getProjectSummary(companyId, projectId);
    if (summary) {
      await cacheSet(cacheKey, summary, cacheTTL.projectSummary, [
        cacheTags.project(companyId, projectId),
        cacheTags.company(companyId),
      ]);
    }

    return summary;
  },

  async getEnhancedDashboardSummary(companyId: string) {
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
};
