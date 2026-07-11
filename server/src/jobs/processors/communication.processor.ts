import { notificationRepository } from "../../repositories/notification.repository.js";
import { emailService } from "../../services/email.service.js";
import { recordBullMQJob } from "../../observability/collectors.js";
import logger from "../../utils/logger.js";
import type { NotificationJob, EmailJob } from "../queues.js";
import { jobNames } from "../jobNames.js";

// ─── Notification handler ─────────────────────────────────────────────────────

export async function processNotificationJob(data: NotificationJob): Promise<void> {
  const start = performance.now();
  try {
    await notificationRepository.create(data);
    recordBullMQJob(
      "communication",
      jobNames.sendNotification,
      "completed",
      (performance.now() - start) / 1000
    );
  } catch (error) {
    recordBullMQJob(
      "communication",
      jobNames.sendNotification,
      "failed",
      (performance.now() - start) / 1000
    );
    throw error;
  }
}

// ─── Email handler ────────────────────────────────────────────────────────────────

export async function processEmailJob(data: EmailJob): Promise<void> {
  const start = performance.now();
  const toLabel = Array.isArray(data.to) ? data.to.join(", ") : data.to;
  try {
    await emailService.send({
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text,
      replyTo: data.replyTo,
    });
    recordBullMQJob(
      "communication",
      jobNames.sendEmail,
      "completed",
      (performance.now() - start) / 1000
    );
  } catch (error) {
    recordBullMQJob(
      "communication",
      jobNames.sendEmail,
      "failed",
      (performance.now() - start) / 1000
    );
    logger.error({ err: error, to: toLabel }, "[email] Failed to deliver");
    throw error; // BullMQ will retry per job options
  }
}