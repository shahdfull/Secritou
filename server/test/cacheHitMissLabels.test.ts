// SEC-159: redis_cache_hits_total/redis_cache_misses_total were declared without labelNames —
// every cache key (dashboard, client/project/success/onboarding summaries, authMe,
// managerPermissions) shared the same two global counters, making it impossible to tell the
// manager-permissions cache's hit rate (TTL 5min) apart from the dashboard cache's (TTL 60s) in
// production Prometheus/Grafana. Fixed by adding a `prefix` label (the cache key's domain
// segment, e.g. "cache:dashboard:..." -> "dashboard") derived once in
// collectors.ts#cachePrefix and threaded through recordCacheHit/recordCacheMiss, which
// cacheService.ts#cacheGet now calls with the real key instead of no arguments.
//
// This test imports and calls the real recordCacheHit/recordCacheMiss (collectors.ts) — not a
// reimplementation — with real cacheKeys.ts-shaped keys, then reads the real Prometheus registry
// (metrics.ts#registry) to confirm distinct labeled series exist per prefix. No database or
// Redis connection required — these two functions are pure metric recording, with no I/O.

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { recordCacheHit, recordCacheMiss } from "../src/observability/collectors.js";
import { registry } from "../src/observability/metrics.js";
import { cacheKeys } from "../src/cache/cacheKeys.js";

describe("redis_cache_hits_total/misses_total are labeled by key prefix (SEC-159)", () => {
  test("a hit on a dashboard-prefixed key and a miss on a manager-prefixed key produce two distinct labeled series", async () => {
    recordCacheHit(cacheKeys.dashboardSummary());
    recordCacheMiss(cacheKeys.managerPermissions("some-user-id"));

    const metricsText = await registry.metrics();

    assert.match(metricsText, /redis_cache_hits_total\{prefix="dashboard"/, "the dashboard-prefixed hit must be its own labeled series");
    assert.match(metricsText, /redis_cache_misses_total\{prefix="manager"/, "the manager-prefixed miss must be its own labeled series");
  });

  test("two different prefixes never collapse into the same series", async () => {
    recordCacheHit(cacheKeys.clientSummary("client-1"));
    recordCacheHit(cacheKeys.onboardingSummary("client-2"));

    const metricsText = await registry.metrics();

    assert.match(metricsText, /redis_cache_hits_total\{prefix="client"/);
    assert.match(metricsText, /redis_cache_hits_total\{prefix="onboarding"/);
  });
});
