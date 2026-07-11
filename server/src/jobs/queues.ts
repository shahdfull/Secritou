import { Queue } from "bullmq";
import * as Sentry from "@sentry/node";
import { jobNames, queueNames } from "./jobNames.js";
import { getBullRedisConnection } from "./redisConnection.js";
import { env } from "../config/env.js";
import logger from "../utils/logger.js";
import type { NotificationType } from "@prisma/client";
import type {
  GeneratorProposal,
  GeneratorProject,
  GeneratorClient,
  GeneratorManager,
  GeneratorInvoice,
} from "../services/documentGenerator.service.js";

const connection = getBullRedisConnection();

export const communicationQueue = new Queue(queueNames.communication, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export const maintenanceQueue = new Queue(queueNames.maintenance, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const documentsQueue = new Queue(queueNames.documents, {
  connection,
  defaultJobOptions: {
    attempts: 4,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 500,
    removeOnFail: 2000,
  },
});

// ─── Notification job ─────────────────────────────────────────────────────────

export type NotificationJob = {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  entityId?: string;
  link?: string;
};

export async function enqueueNotification(data: NotificationJob) {
  try {
    await communicationQueue.add(jobNames.sendNotification, data);
  } catch (error) {
    logger.error({ err: error }, "[jobs] Failed to enqueue notification");
    if (env.SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }
}

export async function enqueueNotifications(items: NotificationJob[]) {
  if (items.length === 0) return;
  try {
    await communicationQueue.addBulk(
      items.map((data) => ({ name: jobNames.sendNotification, data }))
    );
  } catch (error) {
    logger.error({ err: error }, "[jobs] Failed to enqueue notifications");
    if (env.SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }
}

// ─── Email job ────────────────────────────────────────────────────────────────

export type EmailJob = {
  to: string | string[];
  subject: string;
  html: string;
  /** Optional plain-text fallback; auto-generated from html if omitted. */
  text?: string;
  replyTo?: string;
};

export async function enqueueEmail(data: EmailJob): Promise<void> {
  try {
    await communicationQueue.add(jobNames.sendEmail, data, {
      // Emails get 5 attempts with exponential backoff
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
    });
  } catch (error) {
    logger.error({ err: error }, "[jobs] Failed to enqueue email");
    if (env.SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }
}

export async function enqueueEmails(items: EmailJob[]): Promise<void> {
  if (items.length === 0) return;
  try {
    await communicationQueue.addBulk(
      items.map((data) => ({
        name: jobNames.sendEmail,
        data,
        opts: { attempts: 5, backoff: { type: "exponential", delay: 5000 } },
      }))
    );
  } catch (error) {
    logger.error({ err: error }, "[jobs] Failed to enqueue emails");
    if (env.SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }
}

// ─── Document generation jobs ─────────────────────────────────────────────────
// Each proposal-acceptance / project-completion event enqueues one job per PDF
// so a failure in one document (e.g. contract) retries independently and does
// not block or lose the others. Dates cross the queue as ISO strings (BullMQ
// serializes job data as JSON); the processor parses them back to Date.

export type DocumentJob =
  | { kind: "welcomeLetter"; proposal: GeneratorProposal; project: GeneratorProject; client: GeneratorClient; manager: GeneratorManager; uploadedById: string }
  | { kind: "contract"; proposal: GeneratorProposal; project: GeneratorProject; client: GeneratorClient; uploadedById: string }
  | { kind: "specs"; project: GeneratorProject; client: GeneratorClient; uploadedById: string }
  | { kind: "clientBrief"; project: GeneratorProject; client: GeneratorClient; uploadedById: string }
  | { kind: "quote"; proposal: GeneratorProposal; project: GeneratorProject | null; client: GeneratorClient; uploadedById: string }
  | { kind: "invoice"; invoice: GeneratorInvoice; project: GeneratorProject; client: GeneratorClient; uploadedById: string }
  | { kind: "roadmap"; project: GeneratorProject; uploadedById: string };

export async function enqueueDocumentGeneration(jobs: DocumentJob[]): Promise<void> {
  if (jobs.length === 0) return;
  try {
    await documentsQueue.addBulk(jobs.map((data) => ({ name: jobNames.generateDocument, data })));
  } catch (error) {
    logger.error({ err: error }, "[jobs] Failed to enqueue document generation");
    if (env.SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }
}
