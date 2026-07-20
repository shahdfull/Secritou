// Comment Repository - Data access layer
import { prisma, prismaRead } from "../config/prisma.js";
import type { Prisma } from "@prisma/client";
import { authorPublicSelect } from "../utils/prismaSelects.js";

const commentSelect = {
  id: true,
  content: true,
  taskId: true,
  authorId: true,
  createdAt: true,
  editedAt: true,
  author: { select: authorPublicSelect },
} satisfies Prisma.CommentSelect;

type CommentWithAuthor = Prisma.CommentGetPayload<{ select: typeof commentSelect }>;

export const commentRepository = {
  async create(data: {
    content: string;
    taskId: string;
    authorId: string;
  }): Promise<CommentWithAuthor> {
    return prisma.comment.create({
      data,
      select: commentSelect,
    });
  },

  async findByTaskId(taskId: string): Promise<CommentWithAuthor[]> {
    return prismaRead.comment.findMany({
      where: { taskId },
      select: commentSelect,
      orderBy: { createdAt: "asc" },
    });
  },

  async findById(id: string) {
    return prismaRead.comment.findUnique({ where: { id } });
  },

  async update(id: string, content: string): Promise<CommentWithAuthor> {
    // SEC-071: editedAt marks any edit past creation — the UI uses it to show a "modifié"
    // indicator distinct from createdAt.
    return prisma.comment.update({
      where: { id },
      data: { content, editedAt: new Date() },
      select: commentSelect,
    });
  },

  async delete(id: string): Promise<void> {
    await prisma.comment.delete({ where: { id } });
  },
};
