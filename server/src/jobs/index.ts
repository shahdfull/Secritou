import { Worker, QueueEvents } from "bullmq";
import * as Sentry from "@sentry/node";
import { env } from "../config/env.js";
import logger from "../utils/logger.js";
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
  recalculateClientScores,
  expireProposals,
  markOverdueInvoices,
} from "./processors/maintenance.processor.js";
import {
  checkStaleProjects,
  checkOverdueDeadlines,
  checkInvoiceFollowup,
  weeklyCeoReport,
  checkTaskDeadlines,
} from "./processors/ceoAlerts.processor.js";
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
    logger.error(
      { jobId, queue: queueNames.communication, failedReason },
      `[jobs] Job ${jobId} in "${queueNames.communication}" permanently failed`
    );
    if (env.SENTRY_DSN) {
      Sentry.captureException(new Error(`Job ${jobId} failed: ${failedReason}`));
    }
  });

  communicationEvents.on("stalled", ({ jobId }) => {
    logger.warn(
      { jobId, queue: queueNames.communication },
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
      if (job.name === jobNames.recalculateClientScores) {
        return recalculateClientScores();
      }
      if (job.name === jobNames.expireProposals) {
        return expireProposals();
      }
      if (job.name === jobNames.markOverdueInvoices) {
        return markOverdueInvoices();
      }
      if (job.name === jobNames.checkStaleProjects) {
        return checkStaleProjects();
      }
      if (job.name === jobNames.checkOverdueDeadlines) {
        return checkOverdueDeadlines();
      }
      if (job.name === jobNames.checkInvoiceFollowup) {
        return checkInvoiceFollowup();
      }
      if (job.name === jobNames.weeklyCeoReport) {
        return weeklyCeoReport();
      }
      if (job.name === jobNames.checkTaskDeadlines) {
        return checkTaskDeadlines();
      }
      throw new Error(`Unknown job: ${job.name}`);
    },
    { connection, concurrency: 1 }
  );

  // ── Maintenance queue failure event logger ─────────────────────────────────
  const maintenanceEvents = new QueueEvents(queueNames.maintenance, { connection });

  maintenanceEvents.on("failed", ({ jobId, failedReason }) => {
    logger.error(
      { jobId, queue: queueNames.maintenance, failedReason },
      `[jobs] Job ${jobId} in "${queueNames.maintenance}" permanently failed`
    );
    if (env.SENTRY_DSN) {
      Sentry.captureException(new Error(`Maintenance job ${jobId} failed: ${failedReason}`));
    }
  });

  maintenanceEvents.on("stalled", ({ jobId }) => {
    logger.warn(
      { jobId, queue: queueNames.maintenance },
      `[jobs] Job ${jobId} in "${queueNames.maintenance}" stalled and will be re-queued`
    );
  });

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
  void maintenanceQueue.add(
    jobNames.recalculateClientScores,
    {},
    { repeat: { pattern: "0 2 * * *" }, jobId: "recalculate-client-scores-daily" }
  );
  // Flip expired proposals (hourly so the displayed status stays fresh).
  void maintenanceQueue.add(
    jobNames.expireProposals,
    {},
    { repeat: { pattern: "0 * * * *" }, jobId: "expire-proposals-hourly" }
  );
  // Mark overdue invoices + notify admins (daily, early morning).
  void maintenanceQueue.add(
    jobNames.markOverdueInvoices,
    {},
    { repeat: { pattern: "15 4 * * *" }, jobId: "mark-overdue-invoices-daily" }
  );

  // ── CEO Alerts ──────────────────────────────────────────────────────────────
  void maintenanceQueue.add(
    jobNames.checkStaleProjects,
    {},
    { repeat: { pattern: "0 8 * * *" }, jobId: "check-stale-projects-daily" }
  );
  void maintenanceQueue.add(
    jobNames.checkOverdueDeadlines,
    {},
    { repeat: { pattern: "30 8 * * *" }, jobId: "check-overdue-deadlines-daily" }
  );
  void maintenanceQueue.add(
    jobNames.checkInvoiceFollowup,
    {},
    { repeat: { pattern: "0 9 * * 1" }, jobId: "check-invoice-followup-weekly" }
  );
  void maintenanceQueue.add(
    jobNames.weeklyCeoReport,
    {},
    { repeat: { pattern: "30 7 * * 1" }, jobId: "weekly-ceo-report" }
  );
  void maintenanceQueue.add(
    jobNames.checkTaskDeadlines,
    {},
    { repeat: { pattern: "0 * * * *" }, jobId: "check-task-deadlines-hourly" }
  );
}

startWorkers();
