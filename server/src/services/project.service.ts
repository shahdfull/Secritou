// Service for Projects - SaaS business logic
import logger from "../utils/logger.js";
import { projectRepository } from "../repositories/project.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { clientRepository } from "../repositories/client.repository.js";
import { enqueueNotifications, enqueueDocumentGeneration } from "../jobs/queues.js";
import type { CreateProjectDTO } from "../types/entities.js";
import { HttpError } from "../utils/httpError.js";
import type { Role, ProjectStatus } from "@prisma/client";
import type { ServiceScope } from "../utils/serviceScope.js";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import { prisma, prismaRead } from "../config/prisma.js";
import { auditLogService } from "./auditLog.service.js";
import { getBriefQuestions } from "../constants/briefQuestions.js";
import { invoiceService } from "./invoice.service.js";
import { emailService } from "./email.service.js";
import { projectApprovedClientTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import { roundMoney } from "../utils/vat.js";
import { PROJECT_STATUS_VALID_TRANSITIONS } from "@secritou/shared";
import { notifyN8n } from "../utils/webhook.js";

export type TimelineStepStatus = "done" | "pending" | "locked";

export interface TimelineStep {
  key: string;
  label: string;
  status: TimelineStepStatus;
  date: string | null;
}

export const projectService = {
  async getAllProjects(userId: string, userRole: Role, options: ListQueryOptions, clientId?: string, serviceId?: string | null, statusIn?: ProjectStatus[]) {
    return projectRepository.findAll(userId, userRole, options, clientId, serviceId, statusIn);
  },

  async getDeletedProjects(userId: string, userRole: Role, options: ListQueryOptions, clientId?: string, serviceId?: string | null) {
    return projectRepository.findDeleted(userId, userRole, options, clientId, serviceId);
  },

  async getProjectById(id: string, userId: string, userRole: Role, clientId?: string, serviceId?: string | null) {
    const project = await projectRepository.findById(id, userId, userRole, clientId, serviceId);
    if (!project) throw new HttpError(404, "Project not found");
    // Only meaningful for a project born from a proposal — a directly-created project
    // was never expected to have a deposit invoice in the first place.
    const hasDepositInvoice = project.proposalId ? await projectRepository.hasDepositInvoice(id) : true;
    return { ...project, hasDepositInvoice };
  },

  async createProject(data: CreateProjectDTO, scope?: ServiceScope) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: data.proposalId },
      select: { id: true, status: true },
    });
    if (!proposal) throw new HttpError(404, "Proposal not found");
    if (proposal.status !== "ACCEPTED") {
      throw new HttpError(422, "A project can only be created from an accepted proposal", "PROPOSAL_NOT_ACCEPTED");
    }

    if (scope?.userRole === "MANAGER" && scope.userServiceId) {
      data = { ...data, serviceId: scope.userServiceId };
    }
    const project = await projectRepository.create(data);
    const tagsToInvalidate = [cacheTags.company(), cacheTags.dashboard()];
    if (data.clientId) tagsToInvalidate.push(cacheTags.client(data.clientId));
    await invalidateTags(tagsToInvalidate);

    void notifyN8n("project.created", {
      projectId: project.id,
      name: project.name,
      clientId: project.clientId,
      adminUrl: `${env.FRONTEND_URL}/app/projects/${project.id}`,
      agencyEmail: env.CONTACT_RECEIVER_EMAIL,
    });

    return project;
  },

  async updateProject(id: string, data: Partial<CreateProjectDTO>, scope?: ServiceScope) {
    const project = await projectRepository.findByIdAdmin(id);
    if (!project) throw new HttpError(404, "Project not found");
    if (scope?.userRole === "MANAGER" && scope.userServiceId && project.serviceId !== scope.userServiceId) {
      throw new HttpError(404, "Project not found");
    }

    // Prevent MANAGER from changing serviceId or clientId
    const safeData = { ...data };
    if (scope?.userRole === "MANAGER") {
      // For MANAGER, force serviceId to remain as original, and don't allow changing clientId
      safeData.serviceId = project.serviceId ?? undefined;
      delete safeData.clientId;
    }

    // Validate status changes
    if (safeData.status) {
      // Block COMPLETED via regular update (must use clientApprove)
      if (safeData.status === "COMPLETED") {
        throw new HttpError(422, "Project can only be completed via client approval", "COMPLETION_REQUIRES_CLIENT_APPROVAL");
      }

      const currentStatus = project.status;
      const newStatus = safeData.status;

      if (currentStatus !== newStatus && !PROJECT_STATUS_VALID_TRANSITIONS[currentStatus]?.includes(newStatus)) {
        throw new HttpError(422, `Invalid status transition from ${currentStatus} to ${newStatus}`, "INVALID_STATUS_TRANSITION");
      }
    }

    const updated = await projectRepository.update(id, safeData);

    if (data.status && data.status !== project.status) {
      if (project.clientId) {
        const clientUsers = await userRepository.findByClientId(project.clientId);
        await enqueueNotifications(clientUsers.map((user) => ({ userId: user.id, title: "Mise à jour du projet", message: `Le projet "${project.name}" est passé à ${data.status}` })));
      }

      // Freelancers with an active task on this project were previously never told the
      // project itself changed status (e.g. paused back to PLANNING) — only clientUsers were.
      const assignees = await prismaRead.task.findMany({
        where: { projectId: id, assigneeId: { not: null } },
        distinct: ["assigneeId"],
        select: { assigneeId: true },
      });
      if (assignees.length > 0) {
        await enqueueNotifications(
          assignees.map((a) => ({
            userId: a.assigneeId!,
            title: "Mise à jour du projet",
            message: `Le projet "${project.name}" est passé à ${data.status}`,
          }))
        );
      }
    }

    const tagsToInvalidate = [cacheTags.company(), cacheTags.dashboard(), cacheTags.project(id)];
    if (project.clientId) tagsToInvalidate.push(cacheTags.client(project.clientId));
    await invalidateTags(tagsToInvalidate);
    return updated;
  },

  async deleteProject(id: string, actorId?: string, actorRole?: string) {
    const project = await projectRepository.findByIdAdmin(id);
    if (!project) throw new HttpError(404, "Project not found");

    // A project tied to issued invoices must not be hard-deleted.
    const nonDraftInvoices = await projectRepository.countNonDraftInvoices(id);
    if (nonDraftInvoices > 0) {
      throw new HttpError(409, "Project has issued invoices and cannot be deleted; archive it instead", "PROJECT_HAS_INVOICES");
    }

    const onboardings = await projectRepository.countOnboardings(id);
    if (onboardings > 0) {
      throw new HttpError(409, "Project has an onboarding record and cannot be deleted; archive it instead", "PROJECT_HAS_ONBOARDING");
    }

    const deleted = await projectRepository.delete(id);
    const tagsToInvalidate = [cacheTags.company(), cacheTags.dashboard(), cacheTags.project(id)];
    if (project.clientId) tagsToInvalidate.push(cacheTags.client(project.clientId));
    await invalidateTags(tagsToInvalidate);

    void auditLogService.record({ actorId, actorRole, action: "project.delete", entityType: "Project", entityId: id, before: project });

    void notifyN8n("project.deleted", {
      projectId: id,
      name: project.name,
      clientId: project.clientId,
      agencyEmail: env.CONTACT_RECEIVER_EMAIL,
    });

    return deleted;
  },

  async restoreProject(id: string, actorId?: string, actorRole?: string) {
    const project = await prismaRead.project.findFirst({ where: { id, deletedAt: { not: null } }, select: { id: true, clientId: true } });
    if (!project) throw new HttpError(404, "Project not found");
    const restored = await projectRepository.restore(id);
    const tagsToInvalidate = [cacheTags.company(), cacheTags.dashboard(), cacheTags.project(id)];
    if (project.clientId) tagsToInvalidate.push(cacheTags.client(project.clientId));
    await invalidateTags(tagsToInvalidate);
    void auditLogService.record({ actorId, actorRole, action: "project.restore", entityType: "Project", entityId: id });
    return restored;
  },

  async archiveProject(id: string, actorId?: string, actorRole?: string) {
    const project = await projectRepository.findByIdAdmin(id);
    if (!project) throw new HttpError(404, "Project not found");
    const archived = await projectRepository.archive(id);
    const tagsToInvalidate = [cacheTags.company(), cacheTags.dashboard(), cacheTags.project(id)];
    if (project.clientId) tagsToInvalidate.push(cacheTags.client(project.clientId));
    await invalidateTags(tagsToInvalidate);
    void auditLogService.record({ actorId, actorRole, action: "project.archive", entityType: "Project", entityId: id, before: { status: project.status } });
    return archived;
  },

  // SEC (session 2026-07-18): serviceId was previously never checked against the target
  // project — GET /:id/brief has no authorize() (CLIENT/MANAGER/ADMIN can all reach the
  // controller), and this method itself only scoped CLIENT/FREELANCER, never MANAGER. A
  // Manager from another pole could read any project's brief (potentially confidential
  // client objectives/budget).
  async getBrief(id: string, role: Role, clientId?: string, userId?: string, managerServiceId?: string | null) {
    const where: Record<string, unknown> = { id };
    if (role === "CLIENT") where.clientId = clientId ?? "__none__";
    if (role === "FREELANCER") where.tasks = { some: { assigneeId: userId ?? "__none__" } };
    if (role === "MANAGER") where.serviceId = managerServiceId ?? "__none__";

    // A FREELANCER having a single task on the project previously matched the full project
    // (including briefData — the client's complete questionnaire, potentially confidential
    // objectives/budget) — restrict the select so a FREELANCER only gets whether the brief
    // is done, not its content.
    if (role === "FREELANCER") {
      const project = await prismaRead.project.findFirst({
        where,
        select: { id: true, name: true, serviceType: true, briefCompleted: true, briefCompletedAt: true },
      });
      if (!project) throw new HttpError(404, "Project not found");
      return { project: { ...project, briefData: null, clientId: undefined }, questions: [] };
    }

    const project = await prismaRead.project.findFirst({
      where,
      select: { id: true, name: true, serviceType: true, briefData: true, briefCompleted: true, briefCompletedAt: true, clientId: true, service: { select: { name: true } } },
    });
    if (!project) throw new HttpError(404, "Project not found");
    const questions = getBriefQuestions(project.service?.name);
    return { project, questions };
  },

  async submitBrief(id: string, clientId: string, uploadedById: string, briefData: Record<string, unknown>) {
    const project = await prismaRead.project.findFirst({
      where: { id },
      select: { id: true, name: true, description: true, clientId: true, serviceType: true, briefCompleted: true, budget: true, deadline: true, serviceId: true },
    });
    if (!project) throw new HttpError(404, "Project not found");
    if (project.clientId !== clientId) throw new HttpError(403, "Forbidden");
    if (project.briefCompleted) throw new HttpError(409, "Brief already submitted", "BRIEF_ALREADY_SUBMITTED");

    const updated = await prisma.project.update({ where: { id }, data: { briefData, briefCompleted: true, briefCompletedAt: new Date() } });

    void (async () => {
      try {
        const client = project.clientId ? await clientRepository.findById(project.clientId) : null;
        const docProject = { id: project.id, name: project.name, description: project.description ?? undefined, budget: project.budget ?? undefined, deadline: project.deadline ?? undefined, serviceId: project.serviceId ?? null };
        const docClient = client ? { id: client.id, name: client.name, email: client.email ?? undefined } : { id: clientId, name: "Client", email: undefined };
        await enqueueDocumentGeneration([{ kind: "clientBrief", project: docProject, client: docClient, uploadedById }]);
      } catch (err) {
        logger.error({ err }, "[submitBrief] PDF enqueue failed");
      }

      try {
        const managers = await userRepository.findAdmins();
        await enqueueNotifications(managers.map((u) => ({ userId: u.id, title: "Brief client complété", message: `Le client a complété son brief pour le projet « ${project.name} ».` })));
      } catch (err) {
        logger.error({ err }, "[submitBrief] Manager notification failed");
      }

      void notifyN8n("project.brief_submitted", {
        projectId: project.id,
        projectName: project.name,
        serviceType: project.serviceType,
        briefData,
        callbackUrl: `${env.API_URL}/api/v1/projects/${project.id}/ai-specs`,
        agencyEmail: env.CONTACT_RECEIVER_EMAIL,
      });
    })();

    await invalidateTags([
      cacheTags.company(),
      cacheTags.dashboard(),
      cacheTags.project(id),
      ...(project.clientId ? [cacheTags.client(project.clientId)] : []),
    ]);
    return updated;
  },

  async clientApprove(projectId: string, clientId: string, userId: string) {
    const preread = await prismaRead.project.findFirst({
      where: { id: projectId },
      select: { id: true, name: true, clientId: true, status: true, clientApprovedAt: true, budget: true, client: { select: { id: true, name: true, email: true } }, proposal: { select: { id: true, amount: true, currency: true } }, invoices: { select: { id: true, title: true, invoiceType: true, status: true, amountHT: true } } },
    });
    if (!preread) throw new HttpError(404, "Project not found");
    if (preread.clientId !== clientId) throw new HttpError(403, "Forbidden");
    if (preread.clientApprovedAt) throw new HttpError(409, "Project already approved", "PROJECT_ALREADY_APPROVED");
    if (preread.status === "COMPLETED") throw new HttpError(409, "Project is already completed", "PROJECT_ALREADY_COMPLETED");

    const openTasks = await prismaRead.task.findMany({ where: { projectId, status: { not: "DONE" } }, select: { id: true, title: true, status: true } });
    if (openTasks.length > 0) {
      throw new HttpError(400, `${openTasks.length} tâche(s) non terminée(s)`, "OPEN_TASKS_REMAINING", { tasks: openTasks.map((t) => ({ id: t.id, title: t.title, status: t.status })) });
    }

    const depositInvoice = preread.invoices.find((inv) => inv.invoiceType === "DEPOSIT");
    if (depositInvoice && depositInvoice.status !== "PAID") {
      throw new HttpError(409, "L'acompte doit être payé avant de valider le projet", "DEPOSIT_UNPAID", {
        invoice: { id: depositInvoice.id, title: depositInvoice.title, amountHT: depositInvoice.amountHT, status: depositInvoice.status },
      });
    }

    const unresolvedApprovalsList = await prismaRead.approval.findMany({
      where: { projectId, status: { in: ["PENDING", "REJECTED"] } },
      select: { id: true, title: true, status: true },
    });
    if (unresolvedApprovalsList.length > 0) {
      throw new HttpError(
        409,
        `Impossible de terminer le projet : ${unresolvedApprovalsList.length} validation(s) en attente ou rejetée(s) doivent être résolues d'abord`,
        "PENDING_APPROVALS_REMAINING",
        { approvals: unresolvedApprovalsList }
      );
    }

    const proposalAmount = preread.proposal?.amount != null ? Number(preread.proposal.amount) : 0;
    const depositAmount = depositInvoice?.amountHT != null ? Number(depositInvoice.amountHT) : (proposalAmount > 0 ? roundMoney(proposalAmount * 0.3) : 0);
    const balanceAmount = proposalAmount > 0 ? roundMoney(proposalAmount - depositAmount) : 0;
    const currency = preread.proposal?.currency ?? "TND";

    const result = await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction: the preread checks above ran outside it, so a task
      // could be reopened (DONE -> REVIEW is a valid transition), an Approval created, or the
      // deposit invoice status changed in the window between preread and here. Without this,
      // the project could complete despite one of these conditions no longer holding.
      const [openTasksTx, depositTx, unresolvedApprovalsTx] = await Promise.all([
        tx.task.count({ where: { projectId, status: { not: "DONE" } } }),
        tx.invoice.findFirst({ where: { projectId, invoiceType: "DEPOSIT" }, select: { status: true } }),
        tx.approval.count({ where: { projectId, status: { in: ["PENDING", "REJECTED"] } } }),
      ]);
      if (openTasksTx > 0) {
        throw new HttpError(400, `${openTasksTx} tâche(s) non terminée(s)`, "OPEN_TASKS_REMAINING");
      }
      if (depositTx && depositTx.status !== "PAID") {
        throw new HttpError(409, "L'acompte doit être payé avant de valider le projet", "DEPOSIT_UNPAID");
      }
      if (unresolvedApprovalsTx > 0) {
        throw new HttpError(
          409,
          `Impossible de terminer le projet : ${unresolvedApprovalsTx} validation(s) en attente ou rejetée(s) doivent être résolues d'abord`,
          "PENDING_APPROVALS_REMAINING",
          { unresolvedApprovals: unresolvedApprovalsTx }
        );
      }

      const project = await tx.project.update({
        where: { id: projectId },
        data: { status: "COMPLETED", clientApprovedAt: new Date(), clientApprovedById: userId },
        select: { id: true, name: true, clientId: true, invoices: { select: { invoiceType: true } } },
      });

      // Re-check inside transaction to prevent double creation!
      const balanceAlreadyExistsInTx = project.invoices.some((inv) => inv.invoiceType === "BALANCE");
      let balanceInvoice: { id: string } | null = null;
      if (!balanceAlreadyExistsInTx && balanceAmount > 0 && clientId) {
        balanceInvoice = await invoiceService.createBalanceInvoiceTx(tx, {
          title: `Facture de solde : ${preread.name}`,
          description: `Solde restant (70%) pour le projet ${preread.name}`,
          amountHT: balanceAmount,
          currency,
          clientId,
          projectId,
          proposalId: preread.proposal ? (preread as any).proposal.id : undefined,
          dueInDays: 30,
        });
      }

      return { project, balanceInvoiceId: balanceInvoice?.id ?? null };
    });

    void (async () => {
      if (result.balanceInvoiceId) {
        try {
          const inv = await prismaRead.invoice.findUnique({ where: { id: result.balanceInvoiceId }, select: { id: true, number: true, amount: true, amountHT: true, tvaRate: true, tvaAmount: true, currency: true, dueDate: true } });
          if (inv) {
            await enqueueDocumentGeneration([
              {
                kind: "invoice",
                invoice: {
                  id: inv.id,
                  number: inv.number,
                  amount: inv.amount != null ? Number(inv.amount) : null,
                  amountHT: inv.amountHT != null ? Number(inv.amountHT) : null,
                  tvaRate: inv.tvaRate != null ? Number(inv.tvaRate) : null,
                  tvaAmount: inv.tvaAmount != null ? Number(inv.tvaAmount) : null,
                  currency: inv.currency ?? "TND",
                  dueDate: inv.dueDate,
                },
                project: { id: projectId, name: preread.name, description: undefined, budget: preread.budget ?? undefined, deadline: undefined, serviceId: null },
                client: { id: clientId, name: preread.client?.name ?? "Client", email: preread.client?.email ?? undefined },
                uploadedById: userId,
              },
            ]);
          }
        } catch (err) {
          logger.error({ err }, "[clientApprove] Balance invoice PDF enqueue failed");
        }
      }

      try {
        // Email to managers is sent by the n8n workflow (see notifyN8n below) — only the
        // in-app notification is created directly here.
        const managers = await userRepository.findAdmins();
        await enqueueNotifications(managers.map((u) => ({ userId: u.id, title: "Projet approuvé par le client", message: `Le client ${preread.client?.name ?? ""} a approuvé la livraison du projet « ${preread.name} ». Facture de solde générée.` })));
      } catch (err) {
        logger.error({ err }, "[clientApprove] Manager notification failed");
      }

      void notifyN8n("project.client_approved", {
        projectId,
        name: preread.name,
        clientId,
        clientName: preread.client?.name,
        balanceInvoiceId: result.balanceInvoiceId,
        adminUrl: `${env.FRONTEND_URL}/app/projects/${projectId}`,
        agencyEmail: env.CONTACT_RECEIVER_EMAIL,
      });

      try {
        const clientEmail = preread.client?.email;
        if (clientEmail) {
          const portalUrl = env.FRONTEND_URL ? `${env.FRONTEND_URL}/client/invoices` : `https://app.secritou.com/client/invoices`;
          const tpl = projectApprovedClientTemplate({ clientName: preread.client?.name ?? "Client", projectName: preread.name, portalUrl });
          await emailService.send({ to: clientEmail, ...tpl });
        }
      } catch (err) {
        logger.error({ err }, "[clientApprove] Client email failed");
      }

      // Prompt ADMIN/MANAGER (the only roles allowed to submit a Rating) to rate the
      // freelancer(s) who worked on this project, now that it's complete. Best-effort and
      // non-blocking: clientApprove already rejects a second call on the same project
      // (PROJECT_ALREADY_COMPLETED above), so this only ever runs once per project.
      try {
        const freelancerAssignees = await prismaRead.task.findMany({
          where: { projectId, assignee: { role: "FREELANCER", freelancerProfile: { isNot: null } } },
          distinct: ["assigneeId"],
          select: { assignee: { select: { id: true, name: true, freelancerProfile: { select: { id: true } } } } },
        });
        const freelancers = freelancerAssignees
          .map((t) => t.assignee)
          .filter((a): a is NonNullable<typeof a> => !!a && !!a.freelancerProfile);

        if (freelancers.length > 0) {
          const managers = await userRepository.findAdmins();
          await enqueueNotifications(
            managers.flatMap((m) =>
              freelancers.map((f) => ({
                userId: m.id,
                title: "Évaluer le freelance",
                message: `Le projet « ${preread.name} » est terminé. Pensez à évaluer ${f.name}.`,
                type: "RATING_REQUESTED" as const,
                entityId: f.freelancerProfile!.id,
                link: `/app/freelancers/${f.freelancerProfile!.id}`,
              }))
            )
          );
        }
      } catch (err) {
        logger.error({ err }, "[clientApprove] Rating request notification failed");
      }
    })();

    await invalidateTags([cacheTags.company(), cacheTags.dashboard(), cacheTags.project(projectId), ...(clientId ? [cacheTags.client(clientId)] : [])]);

    return result;
  },

  // SEC (session 2026-07-18): same gap as getBrief above — MANAGER was never scoped by pole.
  async getTimelineStatus(id: string, role: Role, clientId?: string, userId?: string, managerServiceId?: string | null): Promise<TimelineStep[]> {
    const where: Record<string, unknown> = { id };
    if (role === "CLIENT") where.clientId = clientId ?? "__none__";
    if (role === "FREELANCER") where.tasks = { some: { assigneeId: userId ?? "__none__" } };
    if (role === "MANAGER") where.serviceId = managerServiceId ?? "__none__";
    const project = await prismaRead.project.findFirst({
      where,
      select: { id: true, status: true, createdAt: true, briefCompleted: true, briefCompletedAt: true, tasks: { select: { status: true, updatedAt: true } } },
    });
    if (!project) throw new HttpError(404, "Project not found");

    const docs = await prismaRead.document.findMany({ where: { projectId: id }, select: { type: true, signedAt: true, createdAt: true } });

    const docByType = new Map(docs.map((d) => [d.type, d]));
    const contractDoc = docByType.get("CONTRACT");
    const quoteDoc = docByType.get("QUOTE");
    const briefDoc = docByType.get("CLIENT_BRIEF");

    const inProgressTask = project.tasks.find((t) => t.status === "IN_PROGRESS");
    const fmt = (d: Date | null | undefined) => (d ? new Date(d).toISOString().split("T")[0] : null);

    const conditions: Array<{ key: string; label: string; done: boolean; date: Date | null | undefined }> = [
      { key: "confirmed", label: "Projet confirmé", done: true, date: project.createdAt },
      { key: "contract", label: "Contrat signé", done: !!contractDoc?.signedAt, date: contractDoc?.signedAt },
      { key: "quote", label: "Devis validé", done: !!quoteDoc, date: quoteDoc?.createdAt },
      { key: "brief", label: "Informations collectées", done: project.briefCompleted || !!briefDoc, date: project.briefCompletedAt ?? briefDoc?.createdAt },
      { key: "production", label: "Production en cours", done: project.status === "IN_PROGRESS" || project.status === "REVIEW" || project.status === "COMPLETED", date: inProgressTask?.updatedAt ?? null },
      { key: "delivery", label: "Livraison", done: project.status === "REVIEW" || project.status === "COMPLETED", date: null },
      { key: "support", label: "Support / Suivi", done: project.status === "COMPLETED", date: null },
    ];

    let foundPending = false;
    return conditions.map(({ key, label, done, date }) => {
      let status: TimelineStepStatus;
      if (done) {
        status = "done";
      } else if (!foundPending) {
        status = "pending";
        foundPending = true;
      } else {
        status = "locked";
      }
      return { key, label, status, date: done ? fmt(date) : null };
    });
  },
};
