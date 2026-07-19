import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import * as IORedis from "ioredis";
import type { Redis as RedisClient } from "ioredis";
import {
  bullmqJobDuration,
  bullmqJobsActive,
  bullmqJobsDelayed,
  bullmqJobsFailed,
  bullmqJobsProcessed,
  bullmqJobsWaiting,
  processCpuPercent,
  processMemoryHeap,
  processMemoryRss,
  redisCacheHits,
  redisCacheMisses,
  redisConnected,
  redisConnectedClients,
  redisMemoryBytes,
  sqlQueryDuration,
} from "./metrics.js";

const BULLMQ_QUEUES = ["communication", "maintenance", "documents"] as const;
const COLLECT_INTERVAL_MS = 15_000;

let collectTimer: ReturnType<typeof setInterval> | null = null;
let lastCpuUsage = process.cpuUsage();

function isRedisConfigured() {
  return Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
}

function createRedisConnection(): RedisClient {
  const url = process.env.REDIS_URL;
  // ioredis ships as CJS with the constructor on `.default` under esModuleInterop; fall back to the
  // namespace itself when that shape isn't present. Routed through `unknown` because the two shapes
  // (namespace vs. constructor) don't structurally overlap.
  const mod = IORedis as unknown as { default?: typeof IORedis.Redis };
  const Redis = (mod.default ?? (IORedis as unknown as typeof IORedis.Redis));
  if (url) {
    return new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true, connectTimeout: 3000 });
  }
  return new Redis({
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port: Number(process.env.REDIS_PORT ?? 6379),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_DB ?? 0),
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: 3000,
  });
}

async function collectProcessMetrics() {
  const mem = process.memoryUsage();
  processMemoryRss.set(mem.rss);
  processMemoryHeap.set(mem.heapUsed);

  const currentCpu = process.cpuUsage(lastCpuUsage);
  lastCpuUsage = process.cpuUsage();
  const totalMicros = currentCpu.user + currentCpu.system;
  const cpuPercent = (totalMicros / (COLLECT_INTERVAL_MS * 1000)) * 100;
  processCpuPercent.set(Math.min(cpuPercent, 100));
}

async function collectRedisMetrics(redis: RedisClient) {
  try {
    if (redis.status !== "ready") {
      await redis.connect();
    }
    const pong = await redis.ping();
    redisConnected.set(pong === "PONG" ? 1 : 0);

    const info = await redis.info("memory");
    const usedMatch = info.match(/used_memory:(\d+)/);
    if (usedMatch) {
      redisMemoryBytes.set(Number(usedMatch[1]));
    }

    const clientsInfo = await redis.info("clients");
    const clientsMatch = clientsInfo.match(/connected_clients:(\d+)/);
    if (clientsMatch) {
      redisConnectedClients.set(Number(clientsMatch[1]));
    }
  } catch {
    redisConnected.set(0);
  }
}

async function collectBullMQMetrics(redis: RedisClient) {
  for (const queueName of BULLMQ_QUEUES) {
    try {
      // bullmq bundles its own ioredis copy whose Redis type is structurally distinct from ours;
      // the instance is compatible at runtime, so bridge through bullmq's ConnectionOptions.
      const queue = new Queue(queueName, { connection: redis as unknown as ConnectionOptions });
      const counts = await queue.getJobCounts("waiting", "active", "failed", "delayed");
      bullmqJobsWaiting.set({ queue: queueName }, counts.waiting ?? 0);
      bullmqJobsActive.set({ queue: queueName }, counts.active ?? 0);
      bullmqJobsFailed.set({ queue: queueName }, counts.failed ?? 0);
      bullmqJobsDelayed.set({ queue: queueName }, counts.delayed ?? 0);
      await queue.close();
    } catch {
      bullmqJobsWaiting.set({ queue: queueName }, 0);
      bullmqJobsActive.set({ queue: queueName }, 0);
      bullmqJobsFailed.set({ queue: queueName }, 0);
      bullmqJobsDelayed.set({ queue: queueName }, 0);
    }
  }
}

async function collectAll(redis: RedisClient | null) {
  await collectProcessMetrics();
  if (redis) {
    await collectRedisMetrics(redis);
    await collectBullMQMetrics(redis);
  } else {
    redisConnected.set(0);
  }
}

export function startMetricsCollectors() {
  if (collectTimer) return;

  const redis = isRedisConfigured() ? createRedisConnection() : null;

  void collectAll(redis);
  collectTimer = setInterval(() => void collectAll(redis), COLLECT_INTERVAL_MS);
}

export function stopMetricsCollectors() {
  if (collectTimer) {
    clearInterval(collectTimer);
    collectTimer = null;
  }
}

export function recordBullMQJob(
  queue: string,
  jobName: string,
  status: "completed" | "failed",
  durationSec: number,
) {
  bullmqJobDuration.observe({ queue, job_name: jobName, status }, durationSec);
  bullmqJobsProcessed.inc({ queue, job_name: jobName, status });
}

export function recordCacheHit() {
  redisCacheHits.inc();
}

export function recordCacheMiss() {
  redisCacheMisses.inc();
}

export function recordRawSqlDuration(operation: string, durationSec: number) {
  sqlQueryDuration.observe({ operation }, durationSec);
}
