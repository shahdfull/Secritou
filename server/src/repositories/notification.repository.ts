import { prisma, prismaRead } from '../config/prisma.js';

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

  async create(data: { userId: string; title: string; message: string }) {
    return prisma.notification.create({ data });
  },

  async createMany(data: Array<{ userId: string; title: string; message: string }>) {
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
