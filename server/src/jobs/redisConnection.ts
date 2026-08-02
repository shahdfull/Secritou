import * as IORedis from "ioredis";
import { env } from "../config/env.js";

// ioredis ships as CJS with the constructor on `.default` under esModuleInterop; fall back to the
// namespace itself when that shape isn't present.
const Redis = ((IORedis as unknown as { default?: typeof IORedis.Redis }).default ?? (IORedis as unknown as typeof IORedis.Redis));

let connection: InstanceType<typeof Redis> | null = null;

// SEC-094: no retryStrategy meant ioredis's own default (unbounded exponential backoff) kept
// retrying forever against an unreachable host — this connection is created eagerly at
// queues.ts's module scope (not lazily like redis.ts#getRedisClient), so an unreachable Redis at
// import time left the process with a live, endlessly-retrying socket in its event loop,
// confirmed by direct reproduction: importing app.js alone (before any HTTP request) took 10.3s,
// and the process never exited afterward. maxRetriesPerRequest stays null — that one is a real
// BullMQ requirement (blocking commands must not be silently abandoned mid-request), distinct
// from the connection-level retry this fixes.
const MAX_CONNECTION_RETRIES = 5;
function boundedRetryStrategy(retries: number): number | null {
  if (retries > MAX_CONNECTION_RETRIES) return null;
  return Math.min(retries * 200, 2000);
}

export function getBullRedisConnection() {
  if (connection) return connection;

  if (env.REDIS_URL) {
    connection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: boundedRetryStrategy,
    });
    return connection;
  }

  connection = new Redis({
    host: env.REDIS_HOST ?? "127.0.0.1",
    port: env.REDIS_PORT ?? 6379,
    username: env.REDIS_USERNAME,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB ?? 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: boundedRetryStrategy,
  });
  return connection;
}
