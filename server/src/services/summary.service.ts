import { summaryRepository } from "../repositories/summary.repository.js";
import { cacheGet, cacheSet, cacheTTL } from "../cache/cacheService.js";
import { cacheKeys, cacheTags } from "../cache/cacheKeys.js";
import type { Role } from "@prisma/client";

export const summaryService = {
  async getClientSummary(clientId: string, userRole: Role, userClientId: string | null) {
    const summary = await summaryRepository.getClientSummary(clientId, userRole, userClientId);
    // Only cache if ADMIN/MANAGER requests (client-specific requests should not be cached for other users)
    if (summary && (userRole === "ADMIN" || userRole === "MANAGER")) {
      const cacheKey = cacheKeys.clientSummary(clientId);
      await cacheSet(cacheKey, summary, cacheTTL.clientSummary, [
        cacheTags.client(clientId),
        cacheTags.company(),
      ]);
    }
    return summary;
  },

  async getProjectSummary(projectId: string, userRole: Role, userClientId: string | null, userId: string) {
    const summary = await summaryRepository.getProjectSummary(projectId, userRole, userClientId, userId);
    // Only cache if ADMIN/MANAGER requests
    if (summary && (userRole === "ADMIN" || userRole === "MANAGER")) {
      const cacheKey = cacheKeys.projectSummary(projectId);
      await cacheSet(cacheKey, summary, cacheTTL.projectSummary, [
        cacheTags.project(projectId),
        cacheTags.company(),
      ]);
    }
    return summary;
  },

  async getEnhancedDashboardSummary(serviceId?: string | null) {
    // MANAGER scope: bypass the global (company-wide) cache and compute scoped data directly,
    // consistent with dashboardService.getSummary's scoping rule.
    if (serviceId !== undefined) {
      return summaryRepository.getEnhancedDashboardSummary(serviceId);
    }

    const cacheKey = cacheKeys.dashboardSummary();
    const cached = await cacheGet<Awaited<ReturnType<typeof summaryRepository.getEnhancedDashboardSummary>>>(cacheKey);
    if (cached) return cached;

    const summary = await summaryRepository.getEnhancedDashboardSummary();
    await cacheSet(cacheKey, summary, cacheTTL.dashboard, [
      cacheTags.dashboard(),
      cacheTags.company(),
    ]);

    return summary;
  },
};
