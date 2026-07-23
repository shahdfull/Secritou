// TaskChecklistItem Repository - Data access layer
import { prisma, prismaRead } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { HttpError } from "../utils/httpError.js";

// SEC-075/077: caps the number of items per task, consistent with the other guardrails already in
// this module (bulk task actions capped at 100 ids, Kanban/calendar loaded unpaginated up to 200).
const MAX_CHECKLIST_ITEMS_PER_TASK = 100;

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
  //
  // SEC-077: the SEC-075 cap is enforced on this same count, inside this same transaction — not as
  // a separate check beforehand (that would reopen the exact race SEC-074 just closed: several
  // concurrent calls near the limit could all read count<100 before any had inserted, letting the
  // cap be exceeded). A rejection here (limit reached) is a real, final answer — it must not be
  // retried, unlike a serialization conflict.
  async create(data: { title: string; taskId: string }): Promise<ChecklistItem> {
    const attempt = () =>
      prisma.$transaction(
        async (tx) => {
          const position = await tx.taskChecklistItem.count({ where: { taskId: data.taskId } });
          if (position >= MAX_CHECKLIST_ITEMS_PER_TASK) {
            throw new HttpError(
              422,
              `A task cannot have more than ${MAX_CHECKLIST_ITEMS_PER_TASK} checklist items`,
              "CHECKLIST_LIMIT_REACHED"
            );
          }
          return tx.taskChecklistItem.create({
            data: { title: data.title, taskId: data.taskId, position },
            select: checklistItemSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

    // SEC-077 (session 2026-07-23): a flat 0-20ms jitter over 8 attempts was too thin for 5-way
    // concurrent createItem calls racing near the cap under real CI load — several callers could
    // exhaust all 8 retries while still colliding, leaking the raw P2034 to the caller instead of
    // the retry eventually succeeding or (if truly past the cap) hitting CHECKLIST_LIMIT_REACHED.
    // Exponential backoff spreads retries out further on each pass, and more attempts gives more
    // total time for 5 racers to serialize against each other.
    for (let remainingRetries = 12; ; remainingRetries--) {
      try {
        return await attempt();
      } catch (err) {
        if (err instanceof HttpError) throw err;
        const isSerializationConflict = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
        if (!isSerializationConflict || remainingRetries === 0) throw err;
        const attemptNumber = 12 - remainingRetries;
        const backoffMs = Math.min(200, 10 * 2 ** attemptNumber) * Math.random();
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  },

  async update(id: string, data: { title?: string; done?: boolean }): Promise<ChecklistItem> {
    return prisma.taskChecklistItem.update({ where: { id }, data, select: checklistItemSelect });
  },

  async delete(id: string): Promise<void> {
    await prisma.taskChecklistItem.delete({ where: { id } });
  },
};
