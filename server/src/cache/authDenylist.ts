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

// Revokes only the single token identified by jti — never the whole account (userKey).
// For cases where nothing about the account changed and only one session is ending (logout):
// unlike revokeAccessToken, this must never block a different, not-yet-revoked token issued to
// the same user by a subsequent login/refresh.
export async function revokeAccessTokenByJti(input: { jti: string; exp: number }) {
  const redis = await getRedisClient();
  if (!redis) return;

  const ttl = ttlSecondsFromExp(input.exp);
  if (ttl <= 0) return;

  await redis.set(jtiKey(input.jti), "1", { EX: ttl });
}

export async function isAccessTokenRevoked(input: { sub: string; jti?: string }) {
  // SEC-085: the denylist is a defense-in-depth check on top of JWT signature/expiry (the actual
  // authentication mechanism) — its own unavailability must never reject an otherwise-valid token.
  // Without this catch, Redis being down (or even mid-connect past SEC-084's timeout) turned every
  // authenticated request into a 401, not just the cache-dependent ones.
  let redis;
  try {
    redis = await getRedisClient();
  } catch {
    return false;
  }
  if (!redis) return false;

  if (await redis.exists(userKey(input.sub))) return true;
  if (input.jti && (await redis.exists(jtiKey(input.jti)))) return true;
  return false;
}

export const authDenylist = {
  revokeAccessToken,
  revokeAccessTokenByJti,
  isAccessTokenRevoked,
};
