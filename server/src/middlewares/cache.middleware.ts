import type { RequestHandler } from "express";
import { cacheGet, cacheSet, cacheTTL } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import { COMPANY_ID } from "../config/constants.js";

export function httpCache(keyFn: (req: Parameters<RequestHandler>[0]) => string, ttlSeconds: number, tagsFn?: (req: Parameters<RequestHandler>[0]) => string[]): RequestHandler {
  return async (req, res, next) => {
    const key = keyFn(req);
    const cached = await cacheGet<unknown>(key);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }
    res.setHeader("X-Cache", "MISS");
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      void cacheSet(key, body, ttlSeconds, tagsFn?.(req) ?? []);
      return originalJson(body);
    };
    next();
  };
}

export const dashboardCache = httpCache(
  (req) => `cache:dashboard:summary:${COMPANY_ID}`,
  cacheTTL.dashboard,
  (req) => [cacheTags.dashboard(), cacheTags.company()],
);
