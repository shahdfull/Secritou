import { Worker, QueueEvents } from "bullmq";
import { env } from "../config/env.js";
import { jobNames, queueNames } from "./jobNames.js";
import { maintenanceQueue } from "./queues.js";
import { getBullRedisConnection } from "./redisConnection.js";
import {
  processNotificationJob,
  processEmailJob,
} from "./processors/communication.processor.js";
import {
  archiveColdData,
  cleanupExpiredRefreshTokens,
  warmDashboardSummaries,
} from "./processors/maintenance.processor.js";
import type { NotificationJob, EmailJob } from "./queues.js";

const connection = getBullRedisConnection();

function startWorkers() {
  if (!env.JOBS_ENABLED) return;

  // ── Communication worker ────────────────────────────────────────────────────
  new Worker(
    queueNames.communication,
    async (job) => {
      if (job.name === jobNames.sendNotification) {
        return processNotificationJob(job.data as NotificationJob);
      }
      if (job.name === jobNames.sendEmail) {
        return processEmailJob(job.data as EmailJob);
      }
      throw new Error(`Unknown job: ${job.name}`);
    },
    { connection, concurrency: 5 }
  );

  // ── Dead-letter / failure event logger ─────────────────────────────────────
  const communicationEvents = new QueueEvents(queueNames.communication, { connection });

  communicationEvents.on("failed", ({ jobId, failedReason }) => {
    console.error(
      `[jobs] Job ${jobId} in "${queueNames.communication}" permanently failed: ${failedReason}`
    );
  });

  communicationEvents.on("stalled", ({ jobId }) => {
    console.warn(
      `[jobs] Job ${jobId} in "${queueNames.communication}" stalled and will be re-queued`
    );
  });

  // ── Maintenance worker ──────────────────────────────────────────────────────
  new Worker(
    queueNames.maintenance,
    async (job) => {
      if (job.name === jobNames.cleanupRefreshTokens) {
        return cleanupExpiredRefreshTokens();
      }
      if (job.name === jobNames.archiveColdData) {
        return archiveColdData();
      }
      if (job.name === jobNames.warmDashboardSummaries) {
        return warmDashboardSummaries();
      }
      throw new Error(`Unknown job: ${job.name}`);
    },
    { connection, concurrency: 1 }
  );

  // ── Recurring maintenance jobs ──────────────────────────────────────────────
  void maintenanceQueue.add(
    jobNames.cleanupRefreshTokens,
    {},
    { repeat: { pattern: "0 3 * * *" }, jobId: "cleanup-refresh-tokens-daily" }
  );
  void maintenanceQueue.add(
    jobNames.archiveColdData,
    {},
    { repeat: { pattern: "30 3 * * *" }, jobId: "archive-cold-data-daily" }
  );
  void maintenanceQueue.add(
    jobNames.warmDashboardSummaries,
    {},
    { repeat: { pattern: "0 */6 * * *" }, jobId: "warm-dashboard-summaries-6h" }
  );
}

startWorkers();
