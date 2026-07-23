// SEC-174: the access JWT was purely stateless — a deleted/demoted user stayed usable with their
// old rights until natural token expiration (15 min by default). authDenylist.ts adds a Redis
// denylist keyed by sub/jti, checked by authenticate() on every request.
//
// This test imports and calls the real authDenylist (revokeAccessToken/isAccessTokenRevoked) and
// the real authenticate middleware — not a reimplementation — against a real Redis connection
// (same instance cacheService.ts/BullMQ use). Requires Redis reachable; skipped if not (the
// server job's Redis service, ci.yml, keeps this from ever skipping in CI).

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import type { HttpError } from "../src/utils/httpError.js";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "a".repeat(32);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "b".repeat(32);
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "secritou-api";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "secritou-web";
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/secritou?schema=public";

let authenticate: typeof import("../src/middlewares/auth.middleware.js").authenticate;
let authDenylist: typeof import("../src/cache/authDenylist.js").authDenylist;
let closeRedisClient: typeof import("../src/cache/redis.js").closeRedisClient;
let redisAvailable = true;

before(async () => {
  ({ authenticate } = await import("../src/middlewares/auth.middleware.js"));
  ({ authDenylist } = await import("../src/cache/authDenylist.js"));
  ({ closeRedisClient } = await import("../src/cache/redis.js"));
  try {
    // isAccessTokenRevoked returns false both when Redis is unreachable and when the key is
    // simply absent — probe with a real revoke+check round trip to tell the two apart.
    const probeSub = `denylist-probe-${Date.now()}`;
    await authDenylist.revokeAccessToken({ sub: probeSub, exp: Math.floor(Date.now() / 1000) + 60 });
    const seen = await authDenylist.isAccessTokenRevoked({ sub: probeSub });
    if (!seen) throw new Error("redis not reachable or CACHE_ENABLED=false");
  } catch {
    redisAvailable = false;
  }
});

after(async () => {
  if (!redisAvailable) return;
  // This file opens the `redis` package client directly (authDenylist.ts -> redis.ts), separate
  // from the ioredis/BullMQ connection run-all.test.ts already closes — same documented cause as
  // projectModuleCacheInvalidation.test.ts.
  await closeRedisClient();
});

function makeReq(token?: string) {
  return {
    header(name: string) {
      return name === "authorization" && token ? `Bearer ${token}` : undefined;
    },
  };
}

function signAccessToken(overrides: Partial<{ sub: string; jti: string }> = {}) {
  const sub = overrides.sub ?? `user-${Date.now()}`;
  const jti = overrides.jti;
  return {
    sub,
    jti,
    token: jwt.sign(
      {
        id: sub,
        sub,
        jti,
        tokenType: "access",
        email: "admin@example.com",
        role: "ADMIN",
        clientId: null,
      },
      process.env.JWT_ACCESS_SECRET!,
      {
        expiresIn: "15m",
        issuer: process.env.JWT_ISSUER!,
        audience: process.env.JWT_AUDIENCE!,
      },
    ),
  };
}

describe("authDenylist + authenticate — real Redis round trip (SEC-174)", () => {
  test("a token revoked by sub via the real authDenylist is rejected by the real authenticate", async (t) => {
    if (!redisAvailable) {
      t.skip("Redis unreachable in this environment");
      return;
    }

    const { sub, token } = signAccessToken();
    const req = makeReq(token);
    let error: HttpError | undefined;
    await authenticate(req as unknown as Request, {} as Response, (err?: unknown) => {
      error = err as HttpError | undefined;
    });
    assert.equal(error, undefined, "token must be accepted before revocation");

    await authDenylist.revokeAccessToken({ sub });

    let errorAfterRevoke: HttpError | undefined;
    await authenticate(req as unknown as Request, {} as Response, (err?: unknown) => {
      errorAfterRevoke = err as HttpError | undefined;
    });
    assert.equal(errorAfterRevoke?.statusCode, 401, "the same still-unexpired token must now be rejected");
  });

  test("revoking one sub's token does not reject a different, non-revoked sub's token", async (t) => {
    if (!redisAvailable) {
      t.skip("Redis unreachable in this environment");
      return;
    }

    const revoked = signAccessToken({ sub: `user-revoked-${Date.now()}`, jti: `jti-a-${Date.now()}` });
    const other = signAccessToken({ sub: `user-other-${Date.now()}`, jti: `jti-b-${Date.now()}` });

    await authDenylist.revokeAccessToken({ sub: revoked.sub, jti: revoked.jti });

    let revokedError: HttpError | undefined;
    await authenticate(makeReq(revoked.token) as unknown as Request, {} as Response, (err?: unknown) => {
      revokedError = err as HttpError | undefined;
    });
    assert.equal(revokedError?.statusCode, 401);

    let otherError: HttpError | undefined;
    await authenticate(makeReq(other.token) as unknown as Request, {} as Response, (err?: unknown) => {
      otherError = err as HttpError | undefined;
    });
    assert.equal(otherError, undefined, "a different, non-revoked sub's token must still be accepted");
  });

  test("isAccessTokenRevoked returns false for a sub that was never revoked", async (t) => {
    if (!redisAvailable) {
      t.skip("Redis unreachable in this environment");
      return;
    }

    const revoked = await authDenylist.isAccessTokenRevoked({ sub: `never-revoked-${Date.now()}` });
    assert.equal(revoked, false);
  });
});
