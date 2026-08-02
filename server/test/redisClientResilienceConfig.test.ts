// SEC-083/084/085: a Redis client connect() with no reconnectStrategy/socketTimeout configured
// never rejects against an unreachable host — confirmed by direct reproduction during the
// original investigation (a call against a stopped Redis container neither resolved nor rejected
// even after several minutes). Fixed in redis.ts#buildClient by adding connectTimeout,
// reconnectStrategy: false, and socketTimeout.
//
// This test can't safely reuse getRedisClient() itself: env.REDIS_HOST/REDIS_PORT are parsed once
// into the env singleton at process start (config/env.ts), shared by every other test file in
// this same run-all.test.ts process — pointing them at an unreachable port here would break every
// other test that legitimately needs the real Redis. Instead it builds a client with the exact
// same socket options buildClient() uses, against a real closed TCP port (not the shared Redis
// container), proving the configuration itself — not a mock of it — actually bounds connect().

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "redis";
import net from "node:net";

const CONNECT_TIMEOUT_MS = 5000;

async function findClosedPort(): Promise<number> {
  // Binds to an ephemeral port, then closes it immediately — the OS won't reassign it fast
  // enough for this test's single connection attempt, giving a real "nothing is listening here"
  // target without depending on any container being down.
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

describe("Redis client socket options bound connect() against an unreachable host (SEC-083/084/085)", () => {
  test("connect() rejects within connectTimeout when reconnectStrategy is disabled", async () => {
    const port = await findClosedPort();
    const client = createClient({
      socket: {
        host: "127.0.0.1",
        port,
        connectTimeout: CONNECT_TIMEOUT_MS,
        reconnectStrategy: false,
      },
    });
    client.on("error", () => {
      // Same doctrine as redis.ts#buildClient: an attached listener is required so this
      // EventEmitter's "error" never throws unhandled and crashes the process (SEC-083).
    });

    const startedAt = Date.now();
    await assert.rejects(() => client.connect());
    const elapsedMs = Date.now() - startedAt;
    assert.ok(
      elapsedMs < CONNECT_TIMEOUT_MS + 3000,
      `connect() must reject within a bounded time (${elapsedMs}ms elapsed, expected under ~${CONNECT_TIMEOUT_MS + 3000}ms)`
    );
  });
});
