import { executiveMetricsRepository, type ExecutiveMetrics } from "../repositories/executiveMetrics.repository.js";
import { cacheGet, cacheSet, cacheDel } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";

const CACHE_KEY = "executive:metrics:v1";
const CACHE_TTL = 180; // 3 minutes

export const executiveMetricsService = {
  async get(): Promise<ExecutiveMetrics> {
    const cached = await cacheGet<ExecutiveMetrics>(CACHE_KEY);
    if (cached) return cached;

    const metrics = await executiveMetricsRepository.getAll();
    // Tagged so every invalidateTags([cacheTags.dashboard()]) — fired by client,
    // lead, project, task, proposal and invoice mutations — also drops this key.
    await cacheSet(CACHE_KEY, metrics, CACHE_TTL, [cacheTags.dashboard(), cacheTags.company()]);
    return metrics;
  },

  async invalidate(): Promise<void> {
    await cacheDel(CACHE_KEY);
  },
};
