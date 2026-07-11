import type { RequestHandler } from "express";
import { cacheGet, cacheSet, cacheTTL } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import { COMPANY_ID } from "../config/constants.js";
import { buildServiceScope } from "../utils/serviceScope.js";

export function httpCache(
  keyFn: (req: Parameters<RequestHandler>[0]) => string | Promise<string>, 
  ttlSeconds: number, 
  tagsFn?: (req: Parameters<RequestHandler>[0]) => string[] | Promise<string[]>
): RequestHandler {
  return async (req, res, next) => {
    const key = await keyFn(req);
    const cached = await cacheGet<unknown>(key);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }
    res.setHeader("X-Cache", "MISS");
    const originalJson = res.json.bind(res);
    res.json = async (body: unknown) => {
      const tags = tagsFn ? await tagsFn(req) : [];
      await cacheSet(key, body, ttlSeconds, tags);
      return originalJson(body);
    };
    next();
  };
}

export const dashboardCache = httpCache(
  async (req) => {
    const scope = await buildServiceScope(req);
    const serviceIdPart = scope.userServiceId || "admin";
    return `cache:dashboard:summary:${COMPANY_ID}:${serviceIdPart}`;
  },
  cacheTTL.dashboard,
  () => [cacheTags.dashboard(), cacheTags.company()],
);
