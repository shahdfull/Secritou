import { recordCacheHit, recordCacheMiss } from "../observability/collectors.js";
import { getRedisClient } from "./redis.js";

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
  } catch {
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
  } catch {
    return;
  }
}

export async function cacheDel(key: string) {
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    await redis.del(key);
  } catch {
    return;
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
  } catch {
    return;
  }
}

export const cacheTTL = {
  dashboard: 60,
  clientSummary: 300,
  projectSummary: 120,
  successSummary: 300,
  onboardingSummary: 300,
  authMe: 30,
};
