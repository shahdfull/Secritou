// Service for Tasks - SaaS business logic
import { taskRepository } from "../repositories/task.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueNotification, enqueueNotifications } from "../jobs/queues.js";
import type { CreateTaskDTO } from "../types/entities.js";
import { HttpError } from "../utils/httpError.js";
import type { Role, TaskStatus, Priority } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import { assertProjectInScope, assertProjectIsOpenForTaskChanges, type ServiceScope } from "../utils/serviceScope.js";
import { notifyN8n } from "../utils/webhook.js";
import { env } from "../config/env.js";
import { ALLOWED_TASK_TRANSITIONS } from "@secritou/shared";
import { auditLogService } from "./auditLog.service.js";
import { commissionService } from "./commission.service.js";

function assertValidTaskTransition(from: TaskStatus, to: TaskStatus): void {
  const allowed = ALLOWED_TASK_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new HttpError(422, `Cannot transition from ${from} to ${to}. Allowed: ${allowed.join(", ") || "none"}`, "INVALID_TASK_TRANSITION");
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

// RG-005-bis: recalcAutoSplit only needs to run when a project crosses the 0<->1 assigned-
// FREELANCER threshold, not on every unrelated task edit — this counts how many distinct
// FREELANCER assignees the project has right now (post-write), which the caller compares
// against a pre-write count taken before the task change lands.
async function countAssignedFreelancers(projectId: string): Promise<number> {
  const { prismaRead: prisma } = await import("../config/prisma.js");
  const tasks = await prisma.task.findMany({
    where: { projectId, assigneeId: { not: null }, assignee: { role: "FREELANCER" } },
    select: { assigneeId: true },
    distinct: ["assigneeId"],
  });
  return tasks.length;
}

// Never blocks the task response on a recalculation failure — the task write already
// succeeded, and the commission split is a downstream financial concern, not a task concern.
async function maybeRecalcAutoSplit(projectId: string, freelancerCountBefore: number) {
  const freelancerCountAfter = await countAssignedFreelancers(projectId);
  const crossedThreshold =
    (freelancerCountBefore === 0) !== (freelancerCountAfter === 0);
  if (!crossedThreshold) return;
  try {
    await commissionService.recalcAutoSplit(projectId);
  } catch (err) {
    console.error(`recalcAutoSplit failed for project ${projectId}`, err);
  }
}

// RG-031 (refonte paiement à la tâche) : une tâche ne peut pas quitter TODO sans payoutAmount
// fixé, sur un projet en mode PER_TASK — le montant doit être connu avant le travail, pas
// négocié après coup. Sans objet en mode AUTO/MANUAL (pourcentage projet, pas de montant par
// tâche).
async function assertPayoutAmountSetIfLeavingTodo(args: {
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  payoutAmount: unknown;
  projectId: string;
}) {
  if (args.fromStatus !== "TODO" || args.toStatus === "TODO") return;
  const { prismaRead: prisma } = await import("../config/prisma.js");
  const project = await prisma.project.findUnique({ where: { id: args.projectId }, select: { commissionSplitMode: true } });
  if (project?.commissionSplitMode !== "PER_TASK") return;
  if (args.payoutAmount === null || args.payoutAmount === undefined) {
    throw new HttpError(422, "This task's payout amount must be set before it can leave TODO", "TASK_PAYOUT_NOT_SET");
  }
}

// RG-033 (refonte paiement à la tâche) : conflit d'intérêt — un Manager ne peut pas valider
// (faire passer à DONE) sa propre tâche exécutée dans son propre pôle. Seul un ADMIN peut valider
// une tâche assignée au Manager du pôle du projet. Bloqué côté service, jamais laissé à la seule
// UI.
async function assertNoSelfValidationConflict(args: {
  assigneeId: string | null;
  projectId: string;
  validatorId?: string;
  validatorRole?: Role;
}) {
  if (!args.assigneeId) return;
  const { prismaRead: prisma } = await import("../config/prisma.js");
  const [assignee, project] = await Promise.all([
    prisma.user.findUnique({ where: { id: args.assigneeId }, select: { role: true, serviceId: true } }),
    prisma.project.findUnique({ where: { id: args.projectId }, select: { serviceId: true } }),
  ]);
  const assigneeIsPoleManager =
    assignee?.role === "MANAGER" && project?.serviceId != null && assignee.serviceId === project.serviceId;
  if (!assigneeIsPoleManager) return;
  if (args.validatorRole !== "ADMIN") {
    throw new HttpError(
      403,
      "Only an ADMIN can validate a task assigned to the pole's own Manager",
      "SELF_VALIDATION_FORBIDDEN"
    );
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
  async getAllTasks(
    projectId: string | undefined,
    userId: string,
    userRole: Role,
    options: ListQueryOptions,
    scope?: ServiceScope,
    taskFilters?: { assigneeId?: string; overdue?: boolean; priority?: Priority }
  ) {
    return taskRepository.findAll(userId, userRole, options, projectId, scope?.userServiceId, taskFilters);
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
    let assigneeIsFreelancer = false;
    if (data.assigneeId) {
      await assertAssigneeIsValid(data.assigneeId);
      if (data.startDate && data.dueDate) {
        const conflicts = await checkFreelancerAvailability(data.assigneeId, data.startDate, data.dueDate);
        if (conflicts.length > 0) {
          throw new HttpError(409, "Assignee is already booked on an overlapping task", "FREELANCER_UNAVAILABLE", { conflicts });
        }
      }
      const { prismaRead: prismaAssigneeRole } = await import("../config/prisma.js");
      const assigneeUser = await prismaAssigneeRole.user.findUnique({ where: { id: data.assigneeId }, select: { role: true } });
      assigneeIsFreelancer = assigneeUser?.role === "FREELANCER";
    }
    const freelancerCountBefore = assigneeIsFreelancer ? await countAssignedFreelancers(data.projectId) : 0;

    if (data.payoutAmount !== undefined) {
      const { prisma } = await import("../config/prisma.js");
      await prisma.$transaction((tx) =>
        commissionService.assertPayoutBudgetNotExceededTx(tx, {
          projectId: data.projectId,
          candidatePayoutAmount: data.payoutAmount!,
        })
      );
    }
    const task = await taskRepository.create(data);
    if (assigneeIsFreelancer) {
      await maybeRecalcAutoSplit(data.projectId, freelancerCountBefore);
    }
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
      const nextPayoutAmount = data.payoutAmount !== undefined ? data.payoutAmount : task.payoutAmount;
      await assertPayoutAmountSetIfLeavingTodo({
        fromStatus: task.status,
        toStatus: data.status,
        payoutAmount: nextPayoutAmount,
        projectId: task.projectId,
      });
      // RG-033 : la validation (passage à DONE) est le moment où le conflit d'intérêt se joue —
      // un statut qui transite vers DONE sans jamais y être passé auparavant, pas une simple
      // ré-écriture d'un champ sur une tâche déjà DONE.
      if (data.status === "DONE") {
        await assertNoSelfValidationConflict({
          assigneeId: task.assigneeId,
          projectId: task.projectId,
          validatorId: scope?.userId,
          validatorRole: scope?.userRole,
        });
      }
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

    // SEC-070: completedAt is set/cleared exactly on a DONE transition here, never left to
    // updatedAt (which changes on any field edit, unrelated to completion).
    const completedAtPatch =
      data.status && data.status !== task.status
        ? { completedAt: data.status === "DONE" ? new Date() : null }
        : {};
    // RG-033: validatedAt/validatedById are stamped exactly on the transition into DONE, cleared
    // if the task ever moves away from DONE again — mirrors SEC-070's completedAt convention so
    // "who validated this, and when" always reflects the CURRENT DONE state, not a stale one.
    const validationPatch =
      data.status && data.status !== task.status
        ? data.status === "DONE"
          ? { validatedAt: new Date(), validatedById: scope?.userId ?? null }
          : { validatedAt: null, validatedById: null }
        : {};

    const freelancerCountBefore = reassigned ? await countAssignedFreelancers(task.projectId) : 0;

    // RG-030: checked as a standalone assertion (not itself a write) before the single real
    // update below — the check and the write must still observe the same value, so this only
    // runs when payoutAmount is actually changing.
    const previousPayoutAmount = task.payoutAmount === null ? null : Number(task.payoutAmount);
    if (data.payoutAmount !== undefined && data.payoutAmount !== previousPayoutAmount) {
      const { prisma } = await import("../config/prisma.js");
      await prisma.$transaction((tx) =>
        commissionService.assertPayoutBudgetNotExceededTx(tx, {
          projectId: task.projectId,
          taskId: id,
          candidatePayoutAmount: data.payoutAmount!,
        })
      );
    }

    // RG-032 : la génération de la commission TASK_FIXED se fait dans la MÊME transaction que le
    // passage à DONE — si l'une échoue, l'autre n'est jamais persistée seule.
    const enteringDone = data.status === "DONE" && task.status !== "DONE";
    const nextQualityScore = data.qualityScore !== undefined ? data.qualityScore : task.qualityScore;
    const finalPayoutAmount = data.payoutAmount !== undefined ? data.payoutAmount : previousPayoutAmount;

    let updated: Awaited<ReturnType<typeof taskRepository.update>>;
    if (enteringDone && task.assigneeId && finalPayoutAmount !== null && nextQualityScore !== null && nextQualityScore !== undefined) {
      const { prisma } = await import("../config/prisma.js");
      const completedAt = (completedAtPatch as { completedAt?: Date | null }).completedAt ?? new Date();
      updated = await prisma.$transaction(async (tx) => {
        const result = await tx.task.updateMany({ where: { id }, data: { ...data, ...completedAtPatch, ...validationPatch } });
        if (result.count === 0) throw new HttpError(404, "Task not found");
        await commissionService.computeForTaskValidationTx(tx, {
          taskId: id,
          projectId: task.projectId,
          partnerId: task.assigneeId!,
          payoutAmount: finalPayoutAmount,
          dueDate: task.dueDate,
          completedAt: completedAt as Date,
          qualityScore: nextQualityScore,
          reworkCount: task.reworkCount,
        });
        const { taskWithRelationsSelect } = await import("../utils/prismaSelects.js");
        const t = await tx.task.findFirst({ where: { id }, select: taskWithRelationsSelect });
        if (!t) throw new HttpError(404, "Task not found");
        return t;
      });
    } else {
      updated = await taskRepository.update(id, { ...data, ...completedAtPatch, ...validationPatch });
    }
    if (reassigned) {
      await maybeRecalcAutoSplit(task.projectId, freelancerCountBefore);
    }
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

    // RG-032 : une tâche qui repasse hors DONE ne supprime jamais sa Commission TASK_FIXED déjà
    // générée — décision manuelle du CEO, jamais automatique. On se contente d'alerter les
    // ADMIN/Managers du pôle que la tâche et sa commission sont désormais désynchronisées.
    if (data.status && task.status === "DONE" && data.status !== "DONE") {
      const hasCommission = await commissionService.taskHasCommission(id);
      if (hasCommission) {
        const recipients = await userRepository.findAdminsAndPoleManagers(project?.serviceId ?? null);
        await enqueueNotifications(
          recipients.map((u) => ({
            userId: u.id,
            title: "Tâche repassée hors DONE — commission existante",
            message: `La tâche "${updated.title}" a quitté le statut DONE alors qu'une commission avait déjà été générée. Cette commission n'est pas supprimée automatiquement — une décision manuelle est nécessaire.`,
            type: "GENERAL" as const,
            entityId: updated.id,
            link: `/app/tasks?taskId=${updated.id}`,
          }))
        );
      }
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

  // SEC-060 (actions en masse, item 3 du constat P1 rapport Product Owner) : plutôt que dupliquer
  // ou raccourcir la logique métier d'updateTask/deleteTask (transitions de statut valides,
  // vérification de conflit de disponibilité freelancer, notifications, invalidation de cache),
  // le bulk appelle ces méthodes existantes une par une — chaque tâche traverse exactement le
  // même chemin d'autorisation/validation qu'une modification individuelle, aucune règle métier
  // n'est contournée par le bulk. Traitement "au mieux" (pas de transaction tout-ou-rien) : un
  // échec sur une tâche (ex. transition de statut invalide) n'empêche pas les autres de réussir —
  // le rapport détaillé par id permet à l'appelant de voir précisément ce qui a échoué et pourquoi,
  // plutôt qu'un 207/500 opaque sur l'ensemble.
  //
  // SEC-097: each iteration used to be awaited sequentially — with up to 100 ids (the validator's
  // cap) and ~5-8 queries per updateTask/deleteTask call, that serialized up to ~800 round-trips
  // in a single HTTP handler. Promise.allSettled runs every task's full path concurrently instead;
  // each task is still fully independent (its own scope/transition/availability checks), so
  // running them concurrently changes nothing about which succeed or fail, only how long the
  // batch takes to finish.
  async bulkUpdateStatus(taskIds: string[], status: TaskStatus, scope?: ServiceScope) {
    const outcomes = await Promise.allSettled(taskIds.map((id) => this.updateTask(id, { status }, scope)));
    return outcomes.map((outcome, i) => {
      const id = taskIds[i]!;
      if (outcome.status === "fulfilled") return { id, success: true };
      const err = outcome.reason;
      return { id, success: false, error: err instanceof HttpError ? err.message : "Unknown error" };
    });
  },

  async bulkDelete(taskIds: string[], scope?: ServiceScope, actorId?: string, actorRole?: string) {
    const outcomes = await Promise.allSettled(taskIds.map((id) => this.deleteTask(id, scope, actorId, actorRole)));
    return outcomes.map((outcome, i) => {
      const id = taskIds[i]!;
      if (outcome.status === "fulfilled") return { id, success: true };
      const err = outcome.reason;
      return { id, success: false, error: err instanceof HttpError ? err.message : "Unknown error" };
    });
  },
};
