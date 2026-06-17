// Comment Repository - Data access layer
import { prismaRead as prisma } from "../config/prisma.js";
import type { Comment, Prisma } from "@prisma/client";
import { authorPublicSelect } from "../utils/prismaSelects.js";

type CommentWithAuthor = Comment & {
  author: Prisma.UserGetPayload<{ select: typeof authorPublicSelect }>;
};

const commentSelect = {
  id: true,
  content: true,
  taskId: true,
  authorId: true,
  createdAt: true,
  author: { select: authorPublicSelect },
} as const;

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
};
