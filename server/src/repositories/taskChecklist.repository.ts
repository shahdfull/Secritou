// TaskChecklistItem Repository - Data access layer
import { prisma, prismaRead } from "../config/prisma.js";
import type { Prisma } from "@prisma/client";

const checklistItemSelect = {
  id: true,
  title: true,
  done: true,
  position: true,
  taskId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TaskChecklistItemSelect;

type ChecklistItem = Prisma.TaskChecklistItemGetPayload<{ select: typeof checklistItemSelect }>;

export const taskChecklistRepository = {
  async findByTaskId(taskId: string): Promise<ChecklistItem[]> {
    return prismaRead.taskChecklistItem.findMany({
      where: { taskId },
      select: checklistItemSelect,
      orderBy: { position: "asc" },
    });
  },

  async findById(id: string): Promise<ChecklistItem | null> {
    return prismaRead.taskChecklistItem.findUnique({ where: { id }, select: checklistItemSelect });
  },

  // Appended at the end of the existing list — the caller (service) computes the next position
  // from the current count rather than trusting a client-supplied index.
  async create(data: { title: string; taskId: string; position: number }): Promise<ChecklistItem> {
    return prisma.taskChecklistItem.create({ data, select: checklistItemSelect });
  },

  async update(id: string, data: { title?: string; done?: boolean }): Promise<ChecklistItem> {
    return prisma.taskChecklistItem.update({ where: { id }, data, select: checklistItemSelect });
  },

  async delete(id: string): Promise<void> {
    await prisma.taskChecklistItem.delete({ where: { id } });
  },

  async countByTaskId(taskId: string): Promise<number> {
    return prisma.taskChecklistItem.count({ where: { taskId } });
  },
};
