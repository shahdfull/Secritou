import { notificationRepository } from '../repositories/notification.repository.js';
import { prisma } from '../config/prisma.js';

export const notificationService = {
  async getNotifications(userId: string) {
    return notificationRepository.findByUserId(userId);
  },

  async markAsRead(id: string, userId: string) {
    return notificationRepository.markAsRead(id, userId);
  },

  async markAllAsRead(userId: string) {
    return notificationRepository.markAllAsRead(userId);
  },

  async cleanupOldNotifications() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const result = await prisma.notification.deleteMany({
      where: { read: true, createdAt: { lt: cutoffDate } },
    });
    return result.count;
  },
};
