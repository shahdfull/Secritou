import { executiveMetricsRepository, type ExecutiveMetrics } from "../repositories/executiveMetrics.repository.js";
import { cacheGet, cacheSet, cacheDel } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";

const CACHE_KEY_BASE = "executive:metrics:v1";
const CACHE_TTL = 180; // 3 minutes

export const executiveMetricsService = {
  async get(serviceId?: string): Promise<ExecutiveMetrics> {
    // Keyed per-service so a MANAGER's scoped view is never served from (or poisons)
    // the ADMIN's unscoped cache entry, or another pole's.
    const cacheKey = serviceId ? `${CACHE_KEY_BASE}:${serviceId}` : CACHE_KEY_BASE;
    const cached = await cacheGet<ExecutiveMetrics>(cacheKey);
    if (cached) return cached;

    const metrics = await executiveMetricsRepository.getAll(serviceId);
    // Tagged so every invalidateTags([cacheTags.dashboard()]) — fired by client,
    // lead, project, task, proposal and invoice mutations — also drops this key.
    await cacheSet(cacheKey, metrics, CACHE_TTL, [cacheTags.dashboard(), cacheTags.company()]);
    return metrics;
  },

  async invalidate(): Promise<void> {
    await cacheDel(CACHE_KEY_BASE);
  },
};
