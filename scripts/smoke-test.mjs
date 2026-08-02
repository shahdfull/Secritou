#!/usr/bin/env node
/**
 * Phase 3 point 3 of the QA mandate: a post-deployment smoke test — startup, login, API
 * responds. Deliberately independent of node:test/Playwright (no test runner, no browser) so it
 * can run against ANY deployed environment (staging, production) with just Node and network
 * access, not just this repo's own dev/CI setup.
 *
 * Usage:
 *   node scripts/smoke-test.mjs [baseUrl] [adminEmail] [adminPassword]
 *   node scripts/smoke-test.mjs http://localhost:5000
 *   node scripts/smoke-test.mjs https://api.secritou.tn admin@secritou.tn "real-password"
 *
 * Exit 0 = all checks passed. Exit 1 = at least one check failed (details printed to stdout).
 * Login/authenticated checks are skipped (not failed) if no credentials are supplied — a
 * deployment smoke test must never require a hardcoded password in a script committed to git.
 */

const baseUrl = (process.argv[2] || "http://localhost:5000").replace(/\/$/, "");
const adminEmail = process.argv[3];
const adminPassword = process.argv[4];

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✔" : "✖"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function checkHealth() {
  const startedAt = Date.now();
  try {
    const res = await fetch(`${baseUrl}/api/v1/health`, { signal: AbortSignal.timeout(10_000) });
    const elapsedMs = Date.now() - startedAt;
    const body = await res.json();
    record(
      "GET /api/v1/health responds 200",
      res.status === 200 && body?.data?.status === "ok",
      `status=${res.status}, elapsed=${elapsedMs}ms`
    );
  } catch (err) {
    record("GET /api/v1/health responds 200", false, err instanceof Error ? err.message : String(err));
  }
}

async function checkReady() {
  try {
    const res = await fetch(`${baseUrl}/api/v1/health/ready`, { signal: AbortSignal.timeout(15_000) });
    const body = await res.json();
    // 503/degraded is a legitimate real state (e.g. Redis genuinely down) — this check reports
    // it, doesn't fail the whole smoke test on it, since the API itself did respond as designed.
    record(
      "GET /api/v1/health/ready responds",
      res.status === 200 || res.status === 503,
      `status=${res.status}, checks=${JSON.stringify(body?.data?.checks)}`
    );
  } catch (err) {
    record("GET /api/v1/health/ready responds", false, err instanceof Error ? err.message : String(err));
  }
}

async function checkLoginAndAuthenticatedRequest() {
  if (!adminEmail || !adminPassword) {
    console.log("~ login + authenticated request skipped (no credentials supplied as argv[3]/argv[4])");
    return;
  }
  let accessToken;
  try {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json();
    accessToken = body?.data?.tokens?.accessToken;
    record("POST /api/v1/auth/login succeeds with real credentials", res.status === 200 && !!accessToken, `status=${res.status}`);
  } catch (err) {
    record("POST /api/v1/auth/login succeeds with real credentials", false, err instanceof Error ? err.message : String(err));
    return;
  }

  try {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    record("GET /api/v1/auth/me responds 200 with the fresh token", res.status === 200, `status=${res.status}`);
  } catch (err) {
    record("GET /api/v1/auth/me responds 200 with the fresh token", false, err instanceof Error ? err.message : String(err));
  }
}

console.log(`Smoke-testing ${baseUrl}...\n`);
await checkHealth();
await checkReady();
await checkLoginAndAuthenticatedRequest();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length > 0) {
  console.log(`FAILED: ${failed.map((r) => r.name).join(", ")}`);
}
// process.exitCode (not process.exit()) lets pending AbortSignal.timeout() internals unwind on
// their own — a forced exit() right after those fire can hit a libuv assertion on Windows/Node 24
// (UV_HANDLE_CLOSING) when a timeout handle is still mid-teardown.
process.exitCode = failed.length > 0 ? 1 : 0;
