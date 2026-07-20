// Service for TaskChecklistItem - SaaS business logic
import { taskChecklistRepository } from "../repositories/taskChecklist.repository.js";
import { taskRepository } from "../repositories/task.repository.js";
import { HttpError } from "../utils/httpError.js";
import { assertProjectIsOpenForTaskChanges } from "../utils/serviceScope.js";

// SEC-089: task.service.ts already refuses any task-field change on an archived/COMPLETED
// project — but checklist items kept accepting create/update/delete on such a task, which is
// the same "task is frozen" invariant, just on a different piece of its content.
async function assertTaskIsOpenForChecklistChanges(taskId: string): Promise<void> {
  const task = await taskRepository.findByIdAdmin(taskId);
  if (!task) throw new HttpError(404, "Task not found");
  await assertProjectIsOpenForTaskChanges(task.projectId);
}

export const taskChecklistService = {
  async getByTaskId(taskId: string) {
    return taskChecklistRepository.findByTaskId(taskId);
  },

  // Appended at the end — position is derived server-side, and the SEC-075 cap enforced, inside
  // taskChecklistRepository.create's own Serializable transaction (SEC-074/SEC-077): the count
  // that gates the cap and the count that derives the position are the same read, so no separate
  // pre-check here could ever race against it.
  async createItem(taskId: string, title: string) {
    await assertTaskIsOpenForChecklistChanges(taskId);
    return taskChecklistRepository.create({ title, taskId });
  },

  async updateItem(taskId: string, itemId: string, data: { title?: string; done?: boolean }) {
    const item = await taskChecklistRepository.findById(itemId);
    if (!item || item.taskId !== taskId) throw new HttpError(404, "Checklist item not found");
    await assertTaskIsOpenForChecklistChanges(taskId);
    return taskChecklistRepository.update(itemId, data);
  },

  async deleteItem(taskId: string, itemId: string) {
    const item = await taskChecklistRepository.findById(itemId);
    if (!item || item.taskId !== taskId) throw new HttpError(404, "Checklist item not found");
    await assertTaskIsOpenForChecklistChanges(taskId);
    await taskChecklistRepository.delete(itemId);
  },
};
