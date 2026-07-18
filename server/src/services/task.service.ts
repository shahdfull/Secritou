// Service for Tasks - SaaS business logic
import { taskRepository } from "../repositories/task.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueNotification, enqueueNotifications } from "../jobs/queues.js";
import type { CreateTaskDTO } from "../types/entities.js";
import { HttpError } from "../utils/httpError.js";
import type { Role, TaskStatus } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import { assertProjectInScope, type ServiceScope } from "../utils/serviceScope.js";
import { notifyN8n } from "../utils/webhook.js";
import { env } from "../config/env.js";
import { ALLOWED_TASK_TRANSITIONS } from "@secritou/shared";
import { auditLogService } from "./auditLog.service.js";

function assertValidTaskTransition(from: TaskStatus, to: TaskStatus): void {
  const allowed = ALLOWED_TASK_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new HttpError(422, `Cannot transition from ${from} to ${to}. Allowed: ${allowed.join(", ") || "none"}`, "INVALID_TASK_TRANSITION");
  }
}

// A COMPLETED or archived project is done: no new tasks and no changes to its existing tasks
// should be possible afterwards (COMPLETED is reached only via clientApprove, which already
// requires every task to be DONE — see project.service.ts#clientApprove).
async function assertProjectIsOpenForTaskChanges(projectId: string) {
  const { prismaRead: prisma } = await import("../config/prisma.js");
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { status: true, archivedAt: true, deletedAt: true },
  });
  if (!project) throw new HttpError(404, "Project not found");
  if (project.archivedAt || project.deletedAt) {
    throw new HttpError(409, "This project is archived and no longer accepts task changes", "PROJECT_ARCHIVED");
  }
  if (project.status === "COMPLETED") {
    throw new HttpError(409, "This project is completed and no longer accepts task changes", "PROJECT_COMPLETED");
  }
}

// An assignee must be a staff role (ADMIN/MANAGER/FREELANCER) — a CLIENT has no route access
// to tasks at all (task.routes.ts never authorizes CLIENT), so assigning one would silently
// strand the task with an assignee who can never update it. Also doubles as the existence
// check for assigneeId, turning a would-be Prisma FK violation (P2003) into a clean 422.
async function assertAssigneeIsValid(assigneeId: string) {
  const { prismaRead: prisma } = await import("../config/prisma.js");
  const user = await prisma.user.findUnique({ where: { id: assigneeId }, select: { role: true } });
  if (!user) throw new HttpError(422, "Assignee not found", "INVALID_ASSIGNEE");
  if (user.role === "CLIENT") {
    throw new HttpError(422, "A task cannot be assigned to a CLIENT", "INVALID_ASSIGNEE_ROLE");
  }
}

export interface FreelancerConflict {
  taskId: string;
  title: string;
  startDate: Date;
  dueDate: Date;
  projectId: string;
  projectName: string | null;
}

// Finds this freelancer's other tasks whose [startDate, dueDate] window overlaps the given
// range. Both boundaries are inclusive (a task ending the day another starts counts as a
// conflict), matching how a human reading two date ranges would judge "overlapping". Tasks
// missing either boundary are not assignment-checkable and are excluded from the comparison.
export async function checkFreelancerAvailability(
  freelancerId: string,
  startDate: Date,
  endDate: Date,
  excludeTaskId?: string
): Promise<FreelancerConflict[]> {
  const { prismaRead: prisma } = await import("../config/prisma.js");
  const conflicts = await prisma.task.findMany({
    where: {
      assigneeId: freelancerId,
      ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
      startDate: { not: null, lte: endDate },
      dueDate: { not: null, gte: startDate },
    },
    select: { id: true, title: true, startDate: true, dueDate: true, projectId: true, project: { select: { name: true } } },
  });

  return conflicts.map((c) => ({
    taskId: c.id,
    title: c.title,
    startDate: c.startDate!,
    dueDate: c.dueDate!,
    projectId: c.projectId,
    projectName: c.project?.name ?? null,
  }));
}

export const taskService = {
  async getAllTasks(projectId: string | undefined, userId: string, userRole: Role, options: ListQueryOptions, scope?: ServiceScope) {
    return taskRepository.findAll(userId, userRole, options, projectId, scope?.userServiceId);
  },

  async getFreelancerAvailability(freelancerId: string, startDate: Date, endDate: Date, excludeTaskId?: string) {
    return checkFreelancerAvailability(freelancerId, startDate, endDate, excludeTaskId);
  },

  async getTaskById(id: string, userId: string, userRole: Role, scope?: ServiceScope) {
    const task = await taskRepository.findById(id, userId, userRole, scope?.userServiceId);
    if (!task) throw new HttpError(404, "Task not found");
    return task;
  },

  async createTask(data: CreateTaskDTO, scope?: ServiceScope) {
    await assertProjectInScope(data.projectId, scope);
    await assertProjectIsOpenForTaskChanges(data.projectId);
    if (data.assigneeId) {
      await assertAssigneeIsValid(data.assigneeId);
      if (data.startDate && data.dueDate) {
        const conflicts = await checkFreelancerAvailability(data.assigneeId, data.startDate, data.dueDate);
        if (conflicts.length > 0) {
          throw new HttpError(409, "Assignee is already booked on an overlapping task", "FREELANCER_UNAVAILABLE", { conflicts });
        }
      }
    }
    const task = await taskRepository.create(data);
    if (data.assigneeId) {
      await enqueueNotification({
        userId: data.assigneeId,
        title: "Nouvelle tâche assignée",
        message: `La tâche "${task.title}" vous a été assignée.`,
        type: "TASK_ASSIGNED",
        entityId: task.id,
        link: `/app/tasks?taskId=${task.id}`,
      });

      const { prismaRead: prismaForAssignee } = await import("../config/prisma.js");
      const assignee = await prismaForAssignee.user.findUnique({ where: { id: data.assigneeId }, select: { email: true } });
      void notifyN8n("task.assigned", {
        taskId: task.id,
        title: task.title,
        projectId: data.projectId,
        assigneeId: data.assigneeId,
        assigneeEmail: assignee?.email,
        dueDate: task.dueDate,
        adminUrl: `${env.FRONTEND_URL}/app/tasks?taskId=${task.id}`,
      });
    }
    const { prismaRead: prisma } = await import("../config/prisma.js");
    const project = await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true, clientId: true } });
    const tagsToInvalidate = [cacheTags.company(), cacheTags.dashboard(), cacheTags.project(data.projectId)];
    if (project?.clientId) tagsToInvalidate.push(cacheTags.client(project.clientId));
    await invalidateTags(tagsToInvalidate);
    return task;
  },

  async updateTask(id: string, data: Partial<CreateTaskDTO>, scope?: ServiceScope) {
    const task = await taskRepository.findByIdAdmin(id);
    if (!task) throw new HttpError(404, "Task not found");
    
    // If user is FREELANCER
    if (scope?.userRole === "FREELANCER") {
      // Check if task is assigned to them
      if (task.assigneeId !== scope.userId) {
        throw new HttpError(403, "You can only update tasks assigned to you", "TASK_NOT_ASSIGNED_TO_YOU");
      }
      // Only allow updating status
      const allowedFields = ["status"];
      const dataKeys = Object.keys(data);
      const hasDisallowedFields = dataKeys.some(key => !allowedFields.includes(key));
      if (hasDisallowedFields) {
        throw new HttpError(403, "You can only update task status as a freelancer", "DISALLOWED_FIELD_UPDATE");
      }
    } else {
      // For ADMIN/MANAGER, enforce project scope
      await assertProjectInScope(task.projectId, scope);
    }

    await assertProjectIsOpenForTaskChanges(task.projectId);

    if (data.status && data.status !== task.status) {
      assertValidTaskTransition(task.status, data.status);
    }

    const nextAssigneeId = data.assigneeId !== undefined ? data.assigneeId : task.assigneeId;
    const reassigned = data.assigneeId !== undefined && data.assigneeId !== task.assigneeId;
    if (nextAssigneeId && (reassigned || data.startDate || data.dueDate)) {
      if (reassigned) await assertAssigneeIsValid(nextAssigneeId);
      const nextStartDate = data.startDate ?? task.startDate;
      const nextDueDate = data.dueDate ?? task.dueDate;
      if (nextStartDate && nextDueDate) {
        const conflicts = await checkFreelancerAvailability(nextAssigneeId, nextStartDate, nextDueDate, id);
        if (conflicts.length > 0) {
          throw new HttpError(409, "Assignee is already booked on an overlapping task", "FREELANCER_UNAVAILABLE", { conflicts });
        }
      }
    }

    const updated = await taskRepository.update(id, data);
    const { prismaRead: prisma } = await import("../config/prisma.js");
    const project = await prisma.project.findUnique({ where: { id: task.projectId }, select: { id: true, clientId: true, serviceId: true } });

    // Old assignee is notified of being unassigned/reassigned away — was previously silent.
    if (task.assigneeId && data.assigneeId !== undefined && data.assigneeId !== task.assigneeId) {
      await enqueueNotification({
        userId: task.assigneeId,
        title: "Tâche retirée",
        message: `La tâche "${updated.title}" ne vous est plus assignée.`,
        type: "TASK_ASSIGNED",
        entityId: updated.id,
        link: `/app/tasks`,
      });
    }

    if (data.assigneeId && data.assigneeId !== task.assigneeId) {
      await enqueueNotification({
        userId: data.assigneeId,
        title: "Tâche assignée",
        message: `La tâche "${updated.title}" vous a été assignée.`,
        type: "TASK_ASSIGNED",
        entityId: updated.id,
        link: `/app/tasks?taskId=${updated.id}`,
      });

      const assignee = await prisma.user.findUnique({ where: { id: data.assigneeId }, select: { email: true } });
      void notifyN8n("task.assigned", {
        taskId: updated.id,
        title: updated.title,
        projectId: task.projectId,
        assigneeId: data.assigneeId,
        assigneeEmail: assignee?.email,
        dueDate: updated.dueDate,
        adminUrl: `${env.FRONTEND_URL}/app/tasks?taskId=${updated.id}`,
      });
    }

    // A task moving to REVIEW/DONE was previously silent — managers/admins had no way to
    // know a task was ready for review or finished without manually checking the board.
    if (data.status && data.status !== task.status && (data.status === "REVIEW" || data.status === "DONE")) {
      const recipients = await userRepository.findAdminsAndPoleManagers(project?.serviceId ?? null);
      const label = data.status === "REVIEW" ? "en revue" : "terminée";
      await enqueueNotifications(
        recipients.map((u) => ({
          userId: u.id,
          title: data.status === "REVIEW" ? "Tâche en revue" : "Tâche terminée",
          message: `La tâche "${updated.title}" est passée ${label}.`,
          type: "GENERAL" as const,
          entityId: updated.id,
          link: `/app/tasks?taskId=${updated.id}`,
        }))
      );
    }

    const tagsToInvalidate = [cacheTags.company(), cacheTags.dashboard(), cacheTags.project(task.projectId)];
    if (project?.clientId) tagsToInvalidate.push(cacheTags.client(project.clientId));
    await invalidateTags(tagsToInvalidate);
    return updated;
  },

  async deleteTask(id: string, scope?: ServiceScope, actorId?: string, actorRole?: string) {
    const task = await taskRepository.findByIdAdmin(id);
    if (!task) throw new HttpError(404, "Task not found");
    // Route-level authorize("ADMIN","MANAGER") already excludes FREELANCER, but this defends
    // in depth in case that route config ever changes without this service being revisited.
    if (scope?.userRole === "FREELANCER" && task.assigneeId !== scope.userId) {
      throw new HttpError(403, "You can only delete tasks assigned to you", "TASK_NOT_ASSIGNED_TO_YOU");
    }
    await assertProjectInScope(task.projectId, scope);
    const { prismaRead: prisma } = await import("../config/prisma.js");
    const project = await prisma.project.findUnique({ where: { id: task.projectId }, select: { id: true, clientId: true } });
    const deleted = await taskRepository.delete(id);
    const tagsToInvalidate = [cacheTags.company(), cacheTags.dashboard(), cacheTags.project(task.projectId)];
    if (project?.clientId) tagsToInvalidate.push(cacheTags.client(project.clientId));
    await invalidateTags(tagsToInvalidate);

    if (task.assigneeId) {
      await enqueueNotification({
        userId: task.assigneeId,
        title: "Tâche supprimée",
        message: `La tâche "${task.title}" a été supprimée.`,
        type: "GENERAL",
        entityId: id,
      });
    }

    void auditLogService.record({ actorId, actorRole, action: "task.delete", entityType: "Task", entityId: id, before: task });

    void notifyN8n("task.deleted", {
      taskId: id,
      title: task.title,
      projectId: task.projectId,
      assigneeId: task.assigneeId,
      adminUrl: `${env.FRONTEND_URL}/app/tasks`,
    });

    return deleted;
  },
};
