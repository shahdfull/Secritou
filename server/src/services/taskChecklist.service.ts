// Service for TaskChecklistItem - SaaS business logic
import { taskChecklistRepository } from "../repositories/taskChecklist.repository.js";
import { HttpError } from "../utils/httpError.js";

export const taskChecklistService = {
  async getByTaskId(taskId: string) {
    return taskChecklistRepository.findByTaskId(taskId);
  },

  // Appended at the end — position is derived server-side, and the SEC-075 cap enforced, inside
  // taskChecklistRepository.create's own Serializable transaction (SEC-074/SEC-077): the count
  // that gates the cap and the count that derives the position are the same read, so no separate
  // pre-check here could ever race against it.
  async createItem(taskId: string, title: string) {
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
