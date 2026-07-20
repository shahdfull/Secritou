// Service for TaskChecklistItem - SaaS business logic
import { taskChecklistRepository } from "../repositories/taskChecklist.repository.js";
import { taskRepository } from "../repositories/task.repository.js";
import { HttpError } from "../utils/httpError.js";
import { assertProjectIsOpenForTaskChanges } from "../utils/serviceScope.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";

// SEC-089: task.service.ts already refuses any task-field change on an archived/COMPLETED
// project — but checklist items kept accepting create/update/delete on such a task, which is
// the same "task is frozen" invariant, just on a different piece of its content. Returns the
// task so callers needing its projectId (SEC-098 cache invalidation) don't re-fetch it.
async function assertTaskIsOpenForChecklistChanges(taskId: string) {
  const task = await taskRepository.findByIdAdmin(taskId);
  if (!task) throw new HttpError(404, "Task not found");
  await assertProjectIsOpenForTaskChanges(task.projectId);
  return task;
}

// SEC-098: checklist mutations never invalidated project/client cache tags, unlike
// task.service.ts/project.service.ts which do so on every write — inconsistent, even though no
// consumer currently re-reads the projectSummary/clientSummary cache keys these tags cover (see
// ANOMALIES.yaml SEC-098 note). Fixed for consistency, not because a stale value was observed.
async function invalidateChecklistCache(projectId: string) {
  const { prismaRead: prisma } = await import("../config/prisma.js");
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { clientId: true } });
  const tags = [cacheTags.company(), cacheTags.project(projectId)];
  if (project?.clientId) tags.push(cacheTags.client(project.clientId));
  await invalidateTags(tags);
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
    const task = await assertTaskIsOpenForChecklistChanges(taskId);
    const item = await taskChecklistRepository.create({ title, taskId });
    await invalidateChecklistCache(task.projectId);
    return item;
  },

  async updateItem(taskId: string, itemId: string, data: { title?: string; done?: boolean }) {
    const item = await taskChecklistRepository.findById(itemId);
    if (!item || item.taskId !== taskId) throw new HttpError(404, "Checklist item not found");
    const task = await assertTaskIsOpenForChecklistChanges(taskId);
    const updated = await taskChecklistRepository.update(itemId, data);
    await invalidateChecklistCache(task.projectId);
    return updated;
  },

  async deleteItem(taskId: string, itemId: string) {
    const item = await taskChecklistRepository.findById(itemId);
    if (!item || item.taskId !== taskId) throw new HttpError(404, "Checklist item not found");
    const task = await assertTaskIsOpenForChecklistChanges(taskId);
    await taskChecklistRepository.delete(itemId);
    await invalidateChecklistCache(task.projectId);
  },
};
