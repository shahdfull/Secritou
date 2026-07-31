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

  // SEC-058: addMessage/delete (service) use this as a pre-read immediately followed by a write —
  // must go through the write client (prisma), not prismaRead, per the same doctrine already
  // applied to gdprService (SEC-037). findById above stays on prismaRead for the pure-read case
  // (getById).
  async findByIdForWrite(id: string, userId: string) {
    return prisma.aiConversation.findFirst({
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

  // Follow-up to SEC-059: audit/debug trace of a tool call the assistant made on behalf of this
  // conversation — never blocks the conversation turn on a write failure (see
  // aiConversation.service.ts#recordToolCallSafely), so this itself stays a plain single insert.
  async recordToolCall(
    conversationId: string,
    tool: string,
    args: unknown,
    outcome: "success" | "error" | "unknown_tool",
    rowCount: number | null,
    durationMs: number
  ) {
    return prisma.aiToolCall.create({
      data: { conversationId, tool, args: JSON.stringify(args), outcome, rowCount, durationMs },
    });
  },
};
