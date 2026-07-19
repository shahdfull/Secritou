// TaskChecklistItem Repository - Data access layer
import { prisma, prismaRead } from "../config/prisma.js";
import { Prisma } from "@prisma/client";

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

  // SEC-074: count-then-create wrapped in a single Serializable transaction (same pattern as
  // auth.service.ts#resetPassword, projectTemplate.service.ts#applyToProject) so two concurrent
  // creates on the same task can never both read the same count before either has inserted.
  // Unlike the template-idempotence case, a lost race here isn't a rejection the caller should
  // see — two people adding checklist items to the same task at once is normal, expected usage,
  // not a duplicate-submission bug — so the loser retries (fresh count, same Serializable
  // guarantee) instead of surfacing Postgres's P2034 as a user-facing error.
  async create(data: { title: string; taskId: string }): Promise<ChecklistItem> {
    const attempt = () =>
      prisma.$transaction(
        async (tx) => {
          const position = await tx.taskChecklistItem.count({ where: { taskId: data.taskId } });
          return tx.taskChecklistItem.create({
            data: { title: data.title, taskId: data.taskId, position },
            select: checklistItemSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

    for (let remainingRetries = 8; ; remainingRetries--) {
      try {
        return await attempt();
      } catch (err) {
        const isSerializationConflict = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
        if (!isSerializationConflict || remainingRetries === 0) throw err;
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));
      }
    }
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
