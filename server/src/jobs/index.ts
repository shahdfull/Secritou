import { Worker, QueueEvents, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import * as Sentry from "@sentry/node";
import { env } from "../config/env.js";
import logger from "../utils/logger.js";
import { jobNames, queueNames } from "./jobNames.js";
import { maintenanceQueue, enqueueNotifications, communicationQueue } from "./queues.js";
import { getBullRedisConnection } from "./redisConnection.js";
import {
  processNotificationJob,
  processEmailJob,
} from "./processors/communication.processor.js";
import { processDocumentJob } from "./processors/documents.processor.js";
import {
  archiveColdData,
  cleanupExpiredRefreshTokens,
  warmDashboardSummaries,
  recalculateClientScores,
  expireProposals,
  markOverdueInvoices,
  syncSearchConsole,
  pruneAnalyticsEvents,
  closeStaleUserSessions,
} from "./processors/maintenance.processor.js";
import {
  checkStaleProjects,
  checkOverdueDeadlines,
  checkInvoiceFollowup,
  weeklyCeoReport,
  checkTaskDeadlines,
  checkOverdueTasks,
  checkMeetingReminders,
  checkStaleLeads,
  checkPendingCommissions,
  checkCustomQuestionSla,
  checkApprovalSla,
  weeklyHealthBoardDigest,
} from "./processors/ceoAlerts.processor.js";
import { userRepository } from "../repositories/user.repository.js";
import type { NotificationJob, EmailJob, DocumentJob } from "./queues.js";

// bullmq bundles its own ioredis copy whose Redis type is structurally distinct from ours; the
// instance is compatible at runtime, so bridge through bullmq's ConnectionOptions.
const connection = getBullRedisConnection() as unknown as ConnectionOptions;

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

  communicationEvents.on("failed", async ({ jobId, failedReason }) => {
    logger.error(
      { jobId, queue: queueNames.communication, failedReason },
      `[jobs] Job ${jobId} in "${queueNames.communication}" permanently failed`
    );
    if (env.SENTRY_DSN) {
      Sentry.captureException(new Error(`Job ${jobId} failed: ${failedReason}`));
    }

    // Check if this failed job is a sendEmail job
    try {
      // Re-fetch the job to get its data
      const job = await Job.fromId(communicationQueue, jobId);
      if (job?.name === jobNames.sendEmail) {
        const emailData = job.data as EmailJob;
        const toLabel = Array.isArray(emailData.to) ? emailData.to.join(", ") : emailData.to;
        
        // Notify admins
        const admins = await userRepository.findAdmins();
        await enqueueNotifications(
          admins.map((admin) => ({
            userId: admin.id,
            title: "Échec permanent d'envoi d'email",
            message: `L'envoi de l'email à ${toLabel} (sujet: "${emailData.subject}") a échoué de façon permanente.`,
            type: "GENERAL" as const,
            entityId: jobId,
          }))
        );
      }
    } catch (fetchErr) {
      logger.error({ err: fetchErr, jobId }, "[jobs] Failed to fetch failed job details for admin notification");
    }
  });

  communicationEvents.on("stalled", ({ jobId }) => {
    logger.warn(
      { jobId, queue: queueNames.communication },
      `[jobs] Job ${jobId} in "${queueNames.communication}" stalled and will be re-queued`
    );
  });

  // ── Documents worker ─────────────────────────────────────────────────────────
  new Worker(
    queueNames.documents,
    async (job) => {
      if (job.name === jobNames.generateDocument) {
        return processDocumentJob(job.data as DocumentJob);
      }
      throw new Error(`Unknown job: ${job.name}`);
    },
    { connection, concurrency: 3 }
  );

  const documentsEvents = new QueueEvents(queueNames.documents, { connection });

  documentsEvents.on("failed", ({ jobId, failedReason }) => {
    logger.error(
      { jobId, queue: queueNames.documents, failedReason },
      `[jobs] Job ${jobId} in "${queueNames.documents}" permanently failed`
    );
    if (env.SENTRY_DSN) {
      Sentry.captureException(new Error(`Job ${jobId} failed: ${failedReason}`));
    }
  });

  documentsEvents.on("stalled", ({ jobId }) => {
    logger.warn(
      { jobId, queue: queueNames.documents },
      `[jobs] Job ${jobId} in "${queueNames.documents}" stalled and will be re-queued`
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
      if (job.name === jobNames.checkOverdueTasks) {
        return checkOverdueTasks();
      }
      if (job.name === jobNames.checkMeetingReminders) {
        return checkMeetingReminders();
      }
      if (job.name === jobNames.checkStaleLeads) {
        return checkStaleLeads();
      }
      if (job.name === jobNames.checkPendingCommissions) {
        return checkPendingCommissions();
      }
      if (job.name === jobNames.checkCustomQuestionSla) {
        return checkCustomQuestionSla();
      }
      if (job.name === jobNames.checkApprovalSla) {
        return checkApprovalSla();
      }
      if (job.name === jobNames.weeklyHealthBoardDigest) {
        return weeklyHealthBoardDigest();
      }
      if (job.name === jobNames.syncSearchConsole) {
        return syncSearchConsole();
      }
      if (job.name === jobNames.pruneAnalyticsEvents) {
        return pruneAnalyticsEvents();
      }
      if (job.name === jobNames.closeStaleUserSessions) {
        return closeStaleUserSessions();
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
  // Pull Search Console metrics for connected clients (daily; GSC data itself lags ~2-3 days).
  void maintenanceQueue.add(
    jobNames.syncSearchConsole,
    {},
    { repeat: { pattern: "0 5 * * *" }, jobId: "sync-search-console-daily" }
  );
  // Delete analytics events older than 13 months so the table doesn't grow forever.
  void maintenanceQueue.add(
    jobNames.pruneAnalyticsEvents,
    {},
    { repeat: { pattern: "0 4 * * *" }, jobId: "prune-analytics-events-daily" }
  );
  // Close UserSession rows whose last heartbeat exceeds the idle timeout, so connected-time
  // stats reflect closed sessions promptly rather than only after the next login's read.
  void maintenanceQueue.add(
    jobNames.closeStaleUserSessions,
    {},
    { repeat: { pattern: "*/5 * * * *" }, jobId: "close-stale-user-sessions-5m" }
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
  void maintenanceQueue.add(
    jobNames.checkOverdueTasks,
    {},
    { repeat: { pattern: "0 9 * * *" }, jobId: "check-overdue-tasks-daily" }
  );
  void maintenanceQueue.add(
    jobNames.checkMeetingReminders,
    {},
    { repeat: { pattern: "0 7 * * *" }, jobId: "check-meeting-reminders-daily" }
  );
  void maintenanceQueue.add(
    jobNames.checkStaleLeads,
    {},
    { repeat: { pattern: "15 8 * * *" }, jobId: "check-stale-leads-daily" }
  );
  void maintenanceQueue.add(
    jobNames.checkPendingCommissions,
    {},
    { repeat: { pattern: "30 8 * * *" }, jobId: "check-pending-commissions-daily" }
  );
  // SLA escalation checks (n8n-facing, see notifyN8n) — daily, staggered from the other 08h runs.
  void maintenanceQueue.add(
    jobNames.checkCustomQuestionSla,
    {},
    { repeat: { pattern: "45 8 * * *" }, jobId: "check-custom-question-sla-daily" }
  );
  void maintenanceQueue.add(
    jobNames.checkApprovalSla,
    {},
    { repeat: { pattern: "0 9 * * *" }, jobId: "check-approval-sla-daily" }
  );
  // Weekly health board digest — same Monday morning slot as weeklyCeoReport, offset by 30min.
  void maintenanceQueue.add(
    jobNames.weeklyHealthBoardDigest,
    {},
    { repeat: { pattern: "0 8 * * 1" }, jobId: "weekly-health-board-digest" }
  );
}

startWorkers();
