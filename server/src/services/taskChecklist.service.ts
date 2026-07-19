// Service for TaskChecklistItem - SaaS business logic
import { taskChecklistRepository } from "../repositories/taskChecklist.repository.js";
import { HttpError } from "../utils/httpError.js";

export const taskChecklistService = {
  async getByTaskId(taskId: string) {
    return taskChecklistRepository.findByTaskId(taskId);
  },

  // Appended at the end — position is derived server-side from the current count, never trusted
  // from the client, so two concurrent creates can't collide on the same position.
  async createItem(taskId: string, title: string) {
    const position = await taskChecklistRepository.countByTaskId(taskId);
    return taskChecklistRepository.create({ title, taskId, position });
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
