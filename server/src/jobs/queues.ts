import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";
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

// bullmq bundles its own ioredis copy whose Redis type is structurally distinct from ours; the
// instance is compatible at runtime, so bridge through bullmq's ConnectionOptions.
const connection = getBullRedisConnection() as unknown as ConnectionOptions;

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

// SEC-119: neither job had a jobId, so a double-enqueue of the same business event (e.g. the
// caller's HTTP handler is retried by the client after a server crash, before the original
// response was returned) queued a second, indistinguishable job — a worker crash after the
// side effect but before the BullMQ ack then retries the SAME job too, but that's already
// deduplicated by BullMQ itself via its own attempt tracking; this jobId targets the caller-side
// double-enqueue case instead. Keyed on the business identity of the notification (type + target
// entity + recipient), not its content, so two legitimately distinct notifications for the same
// entity/user/type (at different times, e.g. two different "lead lost" reasons) are not
// conflated — BullMQ treats a duplicate jobId as a no-op (or a rejection, depending on queue
// state), not an error that would surface to the caller. BullMQ rejects a custom jobId containing
// ":" (reserved for its own internal key namespacing), hence "|" as the field separator here.
function notificationJobId(data: NotificationJob): string {
  return `notification|${data.type ?? "GENERAL"}|${data.entityId ?? "none"}|${data.userId}`;
}

export async function enqueueNotification(data: NotificationJob) {
  try {
    await communicationQueue.add(jobNames.sendNotification, data, { jobId: notificationJobId(data) });
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
      items.map((data) => ({ name: jobNames.sendNotification, data, opts: { jobId: notificationJobId(data) } }))
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
  // SEC-119: EmailJob has no inherent business identity (unlike NotificationJob's
  // type+entityId+userId) — subject/html alone aren't a safe dedupe key (two legitimately
  // distinct emails can share a subject). Callers that know their own business event's identity
  // (e.g. "welcome email for proposal X") can opt in by passing one; omitted, behavior is
  // unchanged from before (no jobId, BullMQ assigns a random one — never dropped as a duplicate).
  dedupeKey?: string;
};

// BullMQ rejects a custom jobId containing ":" — see notificationJobId's comment above.
function emailJobId(data: EmailJob): string | undefined {
  return data.dedupeKey ? `email|${data.dedupeKey}` : undefined;
}

export async function enqueueEmail(data: EmailJob): Promise<void> {
  try {
    await communicationQueue.add(jobNames.sendEmail, data, {
      // Emails get 5 attempts with exponential backoff
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
      jobId: emailJobId(data),
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
        opts: { attempts: 5, backoff: { type: "exponential", delay: 5000 }, jobId: emailJobId(data) },
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

// SEC-120: no jobId meant a double-enqueue of the same business event (e.g. acceptWithCascade
// re-run because the caller's HTTP request was retried before the original response returned)
// queued a second, indistinguishable batch of up to 7 document jobs. Keyed on kind + the entity
// the document is FOR (not a generic random id), so a genuine second document of the same kind
// for a DIFFERENT entity is never blocked. This matters more for "specs"/"roadmap" than the
// others: SEC-110 already found regenerateSpecsWithAiContent creates a new versioned document on
// every call (not idempotent) — a jobId here stops a duplicate ENQUEUE from ever reaching the
// processor a second time, which a per-job BullMQ retry (already deduplicated by BullMQ itself
// via its own attempt tracking) wouldn't have protected against on its own.
// BullMQ rejects a custom jobId containing ":" — see notificationJobId's comment above.
function documentJobId(data: DocumentJob): string {
  switch (data.kind) {
    case "welcomeLetter":
    case "contract":
    case "quote":
      return `document|${data.kind}|${data.proposal.id}`;
    case "specs":
    case "clientBrief":
    case "roadmap":
      return `document|${data.kind}|${data.project.id}`;
    case "invoice":
      return `document|${data.kind}|${data.invoice.id}`;
  }
}

export async function enqueueDocumentGeneration(jobs: DocumentJob[]): Promise<void> {
  if (jobs.length === 0) return;
  try {
    await documentsQueue.addBulk(
      jobs.map((data) => ({ name: jobNames.generateDocument, data, opts: { jobId: documentJobId(data) } }))
    );
  } catch (error) {
    logger.error({ err: error }, "[jobs] Failed to enqueue document generation");
    if (env.SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }
}
