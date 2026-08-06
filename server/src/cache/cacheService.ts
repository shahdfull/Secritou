import { recordCacheHit, recordCacheMiss } from "../observability/collectors.js";
import { getRedisClient } from "./redis.js";
import logger from "../utils/logger.js";

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = await getRedisClient();
    if (!redis) return null;
    const raw = await redis.get(key);
    if (!raw) {
      recordCacheMiss(key);
      return null;
    }
    recordCacheHit(key);
    return JSON.parse(raw) as T;
  } catch (err) {
    // SEC-087: this is best-effort — the caller must proceed without the cache, never throw —
    // but a command failing on an already-open connection (unlike getRedisClient's own
    // .on("error", ...), which only covers connection-level errors) previously left no trace at
    // all, aggravating the diagnosis of SEC-084/085-style Redis outages.
    logger.warn({ err, key }, "[cacheService] cacheGet failed, falling back to no cache");
    recordCacheMiss(key);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number, tags: string[] = []) {
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
    for (const tag of tags) {
      await redis.sAdd(tag, key);
    }
  } catch (err) {
    logger.warn({ err, key, tags }, "[cacheService] cacheSet failed, value was not cached");
  }
}

export async function cacheDel(key: string) {
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    await redis.del(key);
  } catch (err) {
    logger.warn({ err, key }, "[cacheService] cacheDel failed, stale value may remain cached");
  }
}

export async function invalidateTags(tags: string[]) {
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    const unique = [...new Set(tags)];
    for (const tag of unique) {
      const keys = await redis.sMembers(tag);
      if (keys.length > 0) await redis.del(keys);
      await redis.del(tag);
    }
  } catch (err) {
    logger.warn({ err, tags }, "[cacheService] invalidateTags failed, stale cached values may remain");
  }
}

export const cacheTTL = {
  dashboard: 60,
  clientSummary: 300,
  projectSummary: 120,
  successSummary: 300,
  onboardingSummary: 300,
  authMe: 30,
  // Short on purpose: the assistant asking the same read tool twice within a turn/minute (e.g.
  // "mes leads ?" then a follow-up filtering question) should hit cache, but a longer TTL would
  // let the AI answer from data that's gone stale relative to what a human sees on the real page.
  aiToolRead: 45,
};
