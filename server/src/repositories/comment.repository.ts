// Comment Repository - Data access layer
import { prismaRead as prisma } from "../config/prisma.js";
import { COMPANY_ID } from "../config/constants.js";
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

  async findByTaskId(taskId: string, companyId: string = COMPANY_ID): Promise<CommentWithAuthor[]> {
    return prisma.comment.findMany({
      where: { taskId, task: { project: { companyId } } },
      select: commentSelect,
      orderBy: { createdAt: "asc" },
    });
  },
};
