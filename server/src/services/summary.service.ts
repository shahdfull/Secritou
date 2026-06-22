import { summaryRepository } from "../repositories/summary.repository.js";
import { cacheGet, cacheSet, cacheTTL } from "../cache/cacheService.js";
import { cacheKeys, cacheTags } from "../cache/cacheKeys.js";
import { COMPANY_ID } from "../config/constants.js";

export const summaryService = {
  async getClientSummary(clientId: string) {
    const cacheKey = cacheKeys.clientSummary(clientId);
    const cached = await cacheGet<Awaited<ReturnType<typeof summaryRepository.getClientSummary>>>(cacheKey);
    if (cached) return cached;

    const summary = await summaryRepository.getClientSummary(COMPANY_ID, clientId);
    if (summary) {
      await cacheSet(cacheKey, summary, cacheTTL.clientSummary, [
        cacheTags.client(clientId),
        cacheTags.company(),
      ]);
    }

    return summary;
  },

  async getProjectSummary(projectId: string) {
    const cacheKey = cacheKeys.projectSummary(projectId);
    const cached = await cacheGet<Awaited<ReturnType<typeof summaryRepository.getProjectSummary>>>(cacheKey);
    if (cached) return cached;

    const summary = await summaryRepository.getProjectSummary(COMPANY_ID, projectId);
    if (summary) {
      await cacheSet(cacheKey, summary, cacheTTL.projectSummary, [
        cacheTags.project(projectId),
        cacheTags.company(),
      ]);
    }

    return summary;
  },

  async getEnhancedDashboardSummary() {
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
};
