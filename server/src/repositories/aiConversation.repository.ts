import { prisma } from "../config/prisma.js";
import { prismaRead } from "../config/prisma.js";
import type { AiMessageRole } from "@prisma/client";

export const aiConversationRepository = {
  async findAll(userId: string, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      prismaRead.aiConversation.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { messages: true } },
        },
      }),
      prismaRead.aiConversation.count({ where: { userId } }),
    ]);
    return { data, total, page, pageSize };
  },

  async findById(id: string, userId: string) {
    return prismaRead.aiConversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  },

  async create(userId: string, title: string, persona?: string) {
    return prisma.aiConversation.create({
      data: { userId, title, persona },
      include: { messages: true },
    });
  },

  async addMessage(conversationId: string, role: AiMessageRole, content: string) {
    const [message] = await prisma.$transaction([
      prisma.aiMessage.create({ data: { conversationId, role, content } }),
      prisma.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
    ]);
    return message;
  },

  async delete(id: string, userId: string) {
    await prisma.aiConversation.deleteMany({ where: { id, userId } });
  },
};
