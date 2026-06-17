import { notificationRepository } from '../repositories/notification.repository.js';

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
};
