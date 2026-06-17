import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { jobNames, queueNames } from "./jobNames.js";
import { maintenanceQueue } from "./queues.js";
import { getBullRedisConnection } from "./redisConnection.js";
import { processNotificationJob } from "./processors/communication.processor.js";
import { archiveColdData, cleanupExpiredRefreshTokens, warmDashboardSummaries } from "./processors/maintenance.processor.js";

const connection = getBullRedisConnection();

function startWorkers() {
  if (!env.JOBS_ENABLED) return;

  new Worker(
    queueNames.communication,
    async (job) => {
      if (job.name === jobNames.sendNotification) {
        return processNotificationJob(job.data as { userId: string; title: string; message: string });
      }
      throw new Error(`Unknown job: ${job.name}`);
    },
    { connection, concurrency: 5 },
  );

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
    { connection, concurrency: 1 },
  );

  void maintenanceQueue.add(
    jobNames.cleanupRefreshTokens,
    {},
    { repeat: { pattern: "0 3 * * *" }, jobId: "cleanup-refresh-tokens-daily" },
  );
  void maintenanceQueue.add(
    jobNames.archiveColdData,
    {},
    { repeat: { pattern: "30 3 * * *" }, jobId: "archive-cold-data-daily" },
  );
  void maintenanceQueue.add(
    jobNames.warmDashboardSummaries,
    {},
    { repeat: { pattern: "0 */6 * * *" }, jobId: "warm-dashboard-summaries-6h" },
  );
}

startWorkers();
