import { notificationRepository } from "../../repositories/notification.repository.js";
import { recordBullMQJob } from "../../observability/collectors.js";
import type { NotificationJob } from "../queues.js";

export async function processNotificationJob(data: NotificationJob) {
  const start = performance.now();
  try {
    await notificationRepository.create(data);
    recordBullMQJob("communication", "send-notification", "completed", (performance.now() - start) / 1000);
  } catch (error) {
    recordBullMQJob("communication", "send-notification", "failed", (performance.now() - start) / 1000);
    throw error;
  }
}
