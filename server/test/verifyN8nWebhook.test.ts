// SEC-110: verifyN8nWebhook's ONLY anti-replay barrier used to be a Redis "seen signature" set,
// which fails open (allows the request) whenever Redis is unreachable — meaning a captured,
// validly-signed callback body was replayable indefinitely if Redis was down, or within the
// 5-minute Redis window even when Redis was up. The inbound callback body itself carried no
// timestamp/nonce we controlled, so nothing else could catch a replay.
//
// This test calls the real verifyN8nWebhook middleware (not a reimplementation) with a body
// signed using the same HMAC construction notifyN8n uses, proving:
// - a stale timestamp (outside the freshness window) is rejected even though the signature
//   itself is perfectly valid — the exact replay scenario SEC-110 describes
// - a missing timestamp field is rejected
// - a fresh timestamp with a valid signature passes through to next() with no error
//
// Does not require Redis or a database — this middleware's HMAC/timestamp checks run before
// either dependency.

import test, { describe, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { Request, Response } from "express";
import type { HttpError } from "../src/utils/httpError.js";

const { verifyN8nWebhook } = await import("../src/middlewares/verifyN8nWebhook.middleware.js");
const { env } = await import("../src/config/env.js");

// The "fresh timestamp" success case below reaches markSignatureSeen, which opens a real `redis`
// package connection (separate from the ioredis/BullMQ one run-all.test.ts already closes — see
// portalActivationOnPayment.test.ts for the same documented cause of a hanging process otherwise).
after(async () => {
  const { closeRedisClient } = await import("../src/cache/redis.js");
  await closeRedisClient();
});

function sign(body: string): string {
  return createHmac("sha256", env.N8N_WEBHOOK_SECRET!).update(body).digest("hex");
}

function makeReq(body: object) {
  const rawBody = JSON.stringify(body);
  return {
    headers: { "x-secritou-signature": sign(rawBody) },
    rawBody,
  } as unknown as Request;
}

describe("verifyN8nWebhook — timestamp freshness (SEC-110)", { skip: env.N8N_WEBHOOK_SECRET ? false : "N8N_WEBHOOK_SECRET not configured" }, () => {
  test("rejects a validly-signed body with a stale timestamp (captured-and-replayed scenario)", async () => {
    const staleTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago, outside the 5-minute window
    const req = makeReq({ aiSummary: "Replayed content", timestamp: staleTimestamp });

    let error: HttpError | undefined;
    await verifyN8nWebhook(req, {} as Response, (err?: unknown) => {
      error = err as HttpError | undefined;
    });

    assert.ok(error, "a stale timestamp must be rejected even with a valid signature");
    assert.equal(error!.statusCode, 401);
    assert.equal(error!.code, "STALE_WEBHOOK");
  });

  test("rejects a validly-signed body with no timestamp field at all", async () => {
    const req = makeReq({ aiSummary: "No timestamp" });

    let error: HttpError | undefined;
    await verifyN8nWebhook(req, {} as Response, (err?: unknown) => {
      error = err as HttpError | undefined;
    });

    assert.ok(error);
    assert.equal(error!.code, "STALE_WEBHOOK");
  });

  test("rejects a timestamp far in the future (clock-skewed or forged)", async () => {
    const futureTimestamp = Date.now() + 10 * 60 * 1000;
    const req = makeReq({ aiSummary: "Future timestamp", timestamp: futureTimestamp });

    let error: HttpError | undefined;
    await verifyN8nWebhook(req, {} as Response, (err?: unknown) => {
      error = err as HttpError | undefined;
    });

    assert.ok(error);
    assert.equal(error!.code, "STALE_WEBHOOK");
  });

  test("passes a validly-signed body with a fresh timestamp through to next() with no error", async () => {
    const req = makeReq({ aiSummary: "Fresh content", timestamp: Date.now() });

    let called = false;
    let error: unknown;
    await verifyN8nWebhook(req, {} as Response, (err?: unknown) => {
      error = err;
      called = true;
    });

    assert.equal(called, true);
    assert.equal(error, undefined, `expected no error, got: ${error instanceof Error ? error.message : error}`);
  });

  test("still rejects an invalid signature regardless of timestamp freshness", async () => {
    const rawBody = JSON.stringify({ aiSummary: "Tampered", timestamp: Date.now() });
    const req = {
      headers: { "x-secritou-signature": "0".repeat(64) },
      rawBody,
    } as unknown as Request;

    let error: HttpError | undefined;
    await verifyN8nWebhook(req, {} as Response, (err?: unknown) => {
      error = err as HttpError | undefined;
    });

    assert.ok(error);
    assert.equal(error!.statusCode, 401);
  });
});
