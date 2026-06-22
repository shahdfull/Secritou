import { prisma } from "../config/prisma.js";
import { prismaRead } from "../config/prisma.js";
import { COMPANY_ID } from "../config/constants.js";
import type { AiMessageRole } from "@prisma/client";

export const aiConversationRepository = {
  async findAll(companyId: string = COMPANY_ID, userId: string, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      prismaRead.aiConversation.findMany({
        where: { companyId, userId },
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
      prismaRead.aiConversation.count({ where: { companyId, userId } }),
    ]);
    return { data, total, page, pageSize };
  },

  async findById(id: string, companyId: string = COMPANY_ID, userId: string) {
    return prismaRead.aiConversation.findFirst({
      where: { id, companyId, userId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
  },

  async create(companyId: string = COMPANY_ID, userId: string, title: string) {
    return prisma.aiConversation.create({
      data: { companyId, userId, title },
      include: { messages: true },
    });
  },

  async addMessage(conversationId: string, role: AiMessageRole, content: string) {
    const [message] = await prisma.$transaction([
      prisma.aiMessage.create({ data: { conversationId, role, content } }),
      prisma.aiConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);
    return message;
  },

  async delete(id: string, companyId: string = COMPANY_ID, userId: string) {
    await prisma.aiConversation.deleteMany({ where: { id, companyId, userId } });
  },

  async deleteAll(companyId: string = COMPANY_ID, userId: string) {
    await prisma.aiConversation.deleteMany({ where: { companyId, userId } });
  },
};
