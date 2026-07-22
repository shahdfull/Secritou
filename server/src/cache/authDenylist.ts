import { getRedisClient } from "./redis.js";
import { env } from "../config/env.js";
import { parseDurationToDate } from "../utils/parseDuration.js";

const ACCESS_DENYLIST_PREFIX = "auth:denylist:access:";

function ttlSecondsFromExp(exp?: number) {
  if (!exp) return 0;
  return Math.max(1, Math.ceil(exp - Date.now() / 1000));
}

function defaultAccessTtlSeconds() {
  return Math.max(1, Math.ceil((parseDurationToDate(env.JWT_ACCESS_EXPIRES_IN).getTime() - Date.now()) / 1000));
}

function userKey(userId: string) {
  return `${ACCESS_DENYLIST_PREFIX}user:${userId}`;
}

function jtiKey(jti: string) {
  return `${ACCESS_DENYLIST_PREFIX}jti:${jti}`;
}

export async function revokeAccessToken(input: { sub: string; exp?: number; jti?: string }) {
  const redis = await getRedisClient();
  if (!redis) return;

  const ttl = input.exp ? ttlSecondsFromExp(input.exp) : defaultAccessTtlSeconds();
  if (ttl <= 0) return;

  await redis.set(userKey(input.sub), "1", { EX: ttl });
  if (input.jti) {
    await redis.set(jtiKey(input.jti), "1", { EX: ttl });
  }
}

export async function isAccessTokenRevoked(input: { sub: string; jti?: string }) {
  const redis = await getRedisClient();
  if (!redis) return false;

  if (await redis.exists(userKey(input.sub))) return true;
  if (input.jti && (await redis.exists(jtiKey(input.jti)))) return true;
  return false;
}

export const authDenylist = {
  revokeAccessToken,
  isAccessTokenRevoked,
};
