// SEC-083/084/085: end-to-end resilience against a genuinely unreachable Redis, exercised through
// the real HTTP stack (app.ts -> health/ready route, authenticate middleware -> authDenylist ->
// redis.ts#getRedisClient) — not a reimplementation, not a mock. Deliberately NOT part of
// run-all.test.ts: env.REDIS_HOST/REDIS_PORT/REDIS_URL are parsed once into a process-wide
// singleton (config/env.ts) at first import — pointing them at an unreachable host here would
// break every other test file sharing that same process's env. Run as a dedicated CI step instead
// (.github/workflows/ci.yml).
//
// Requires SEC-094 (redisConnection.ts#getBullRedisConnection's retryStrategy) to be fixed, or
// simply importing app.js (which transitively imports jobs/queues.ts, which eagerly connects a
// BullMQ ioredis client at module scope) hangs the whole process indefinitely against an
// unreachable Redis — confirmed by direct reproduction while writing this file originally.
//
// Requires a real, migrated database (DATABASE_URL) — skipped automatically if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import request from "supertest";
import net from "node:net";

// A fixed low port (e.g. 1) sits behind a slow-to-refuse OS/firewall path on some hosts (observed
// hanging well past connectTimeout on this machine) — binding then immediately closing a real
// ephemeral port gives a genuine "nothing is listening here" target that actually refuses fast.
async function findClosedPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : undefined;
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error("could not determine an ephemeral port"));
      });
    });
    server.on("error", reject);
  });
}

// REDIS_URL takes priority over REDIS_HOST/REDIS_PORT in both redis.ts#buildClient and
// redisConnection.ts#getBullRedisConnection — must be overridden (it's set in .env for local/CI
// Redis) or both clients would silently keep connecting to the real, reachable Redis regardless
// of REDIS_HOST/REDIS_PORT below. `delete` alone doesn't work here: dotenv's default
// (non-overriding) behavior only skips a variable it finds ALREADY set — deleting it makes env.js's
// `import "dotenv/config"` (triggered by the app.js import below) treat it as unset and reload it
// straight from .env, silently undoing the delete. Setting it to the closed port's own URL instead
// keeps it "already set" from dotenv's point of view, so REDIS_URL and REDIS_HOST/REDIS_PORT agree.
const closedPort = await findClosedPort();
process.env.REDIS_HOST = "127.0.0.1";
process.env.REDIS_PORT = String(closedPort);
process.env.REDIS_URL = `redis://127.0.0.1:${closedPort}`;
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "a".repeat(32);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "b".repeat(32);
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "secritou-api";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "secritou-web";
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
process.env.CACHE_ENABLED = process.env.CACHE_ENABLED ?? "true";

let app: typeof import("../src/app.js").app;
let prisma: typeof import("../src/config/prisma.js").prisma;
let dbAvailable = true;

const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ app } = await import("../src/app.js"));
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe("real HTTP resilience against an unreachable Redis (SEC-083/084/085)", () => {
  test("GET /health/ready responds degraded within a bounded time instead of hanging or crashing", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }

    const startedAt = Date.now();
    const res = await request(app).get("/api/v1/health/ready").timeout(15000);
    const elapsedMs = Date.now() - startedAt;

    assert.equal(res.status, 503, "an unreachable Redis must degrade to 503, not hang or crash");
    assert.equal(res.body.data.checks.redis, "error");
    assert.ok(elapsedMs < 12000, `must respond within a bounded time (${elapsedMs}ms elapsed)`);

    // The process itself must have survived — a second, independent request must still be served.
    const livenessRes = await request(app).get("/api/v1/health").timeout(5000);
    assert.equal(livenessRes.status, 200, "the process must still be alive and serving other routes");
  });

  test("a valid JWT is accepted on a protected route despite Redis being unreachable", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }

    const uniq = Date.now();
    const email = `sec085-${uniq}@test.local`;
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const user = await prisma.user.create({
      data: { name: `SEC085 user ${uniq}`, email, passwordHash, role: "ADMIN" },
    });
    createdUserIds.push(user.id);

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "Password123!" })
      .timeout(10000);
    assert.equal(loginRes.status, 200, "login itself must not depend on Redis");
    const accessToken = loginRes.body.data.tokens.accessToken;

    const startedAt = Date.now();
    const protectedRes = await request(app)
      .get("/api/v1/leads")
      .set("Authorization", `Bearer ${accessToken}`)
      .timeout(10000);
    const elapsedMs = Date.now() - startedAt;

    assert.equal(
      protectedRes.status,
      200,
      "a valid, non-revoked JWT must be accepted even when Redis (a defense-in-depth revocation check) is unreachable"
    );
    assert.ok(elapsedMs < 8000, `must respond within a bounded time (${elapsedMs}ms elapsed)`);
  });
});
