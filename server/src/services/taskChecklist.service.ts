// Service for TaskChecklistItem - SaaS business logic
import { taskChecklistRepository } from "../repositories/taskChecklist.repository.js";
import { HttpError } from "../utils/httpError.js";

// SEC-075: caps the number of items per task, consistent with the other guardrails already in
// this module (bulk task actions capped at 100 ids, Kanban/calendar loaded unpaginated up to 200).
// Enforced here (not in the Zod validator) because it depends on existing DB state, not just the
// shape of the incoming request.
const MAX_CHECKLIST_ITEMS_PER_TASK = 100;

export const taskChecklistService = {
  async getByTaskId(taskId: string) {
    return taskChecklistRepository.findByTaskId(taskId);
  },

  // Appended at the end — position is derived server-side inside taskChecklistRepository.create's
  // own transaction (SEC-074), never trusted from the client, so two concurrent creates can't
  // collide on the same position.
  async createItem(taskId: string, title: string) {
    const existingCount = await taskChecklistRepository.countByTaskId(taskId);
    if (existingCount >= MAX_CHECKLIST_ITEMS_PER_TASK) {
      throw new HttpError(
        422,
        `A task cannot have more than ${MAX_CHECKLIST_ITEMS_PER_TASK} checklist items`,
        "CHECKLIST_LIMIT_REACHED"
      );
    }
    return taskChecklistRepository.create({ title, taskId });
  },

  async updateItem(taskId: string, itemId: string, data: { title?: string; done?: boolean }) {
    const item = await taskChecklistRepository.findById(itemId);
    if (!item || item.taskId !== taskId) throw new HttpError(404, "Checklist item not found");
    return taskChecklistRepository.update(itemId, data);
  },

  async deleteItem(taskId: string, itemId: string) {
    const item = await taskChecklistRepository.findById(itemId);
    if (!item || item.taskId !== taskId) throw new HttpError(404, "Checklist item not found");
    await taskChecklistRepository.delete(itemId);
  },
};
