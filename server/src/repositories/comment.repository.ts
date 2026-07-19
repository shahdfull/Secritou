// Comment Repository - Data access layer
import { prisma as writePrisma, prismaRead as prisma } from "../config/prisma.js";
import type { Prisma } from "@prisma/client";
import { authorPublicSelect } from "../utils/prismaSelects.js";

const commentSelect = {
  id: true,
  content: true,
  taskId: true,
  authorId: true,
  createdAt: true,
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
    return prisma.comment.findMany({
      where: { taskId },
      select: commentSelect,
      orderBy: { createdAt: "asc" },
    });
  },

  async findById(id: string) {
    return prisma.comment.findUnique({ where: { id } });
  },

  async update(id: string, content: string): Promise<CommentWithAuthor> {
    return writePrisma.comment.update({
      where: { id },
      data: { content },
      select: commentSelect,
    });
  },

  async delete(id: string): Promise<void> {
    await writePrisma.comment.delete({ where: { id } });
  },
};
