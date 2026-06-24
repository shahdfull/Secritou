import { prisma, prismaRead } from '../config/prisma.js';
import type { NotificationType } from '@prisma/client';

export type NotificationInput = {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  entityId?: string;
  link?: string;
};

export const notificationRepository = {
  async findByUserId(userId: string) {
    return prismaRead.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  },

  async countUnreadByUserId(userId: string) {
    return prismaRead.notification.count({
      where: { userId, read: false },
    });
  },

  async create(data: NotificationInput) {
    return prisma.notification.create({ data });
  },

  async createMany(data: NotificationInput[]) {
    if (data.length === 0) return { count: 0 };
    return prisma.notification.createMany({ data });
  },

  async markAsRead(id: string, userId: string) {
    return prisma.notification.update({
      where: { id, userId },
      data: { read: true },
    });
  },

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  },
};
