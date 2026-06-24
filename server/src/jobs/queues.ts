import { Queue } from "bullmq";
import * as Sentry from "@sentry/node";
import { jobNames, queueNames } from "./jobNames.js";
import { getBullRedisConnection } from "./redisConnection.js";
import { env } from "../config/env.js";
import type { NotificationType } from "@prisma/client";

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
    console.error("[jobs] Failed to enqueue notification:", error);
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
    console.error("[jobs] Failed to enqueue notifications:", error);
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
    console.error("[jobs] Failed to enqueue email:", error);
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
    console.error("[jobs] Failed to enqueue emails:", error);
    if (env.SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }
}
