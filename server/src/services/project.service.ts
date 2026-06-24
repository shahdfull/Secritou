// Service for Projects - SaaS business logic
import { projectRepository } from "../repositories/project.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { clientRepository } from "../repositories/client.repository.js";
import { enqueueNotifications } from "../jobs/queues.js";
import type { CreateProjectDTO } from "../types/entities.js";
import { HttpError } from "../utils/httpError.js";
import type { Role } from "@prisma/client";
import type { ServiceScope } from "../utils/serviceScope.js";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import { prisma, prismaRead } from "../config/prisma.js";
import { documentGeneratorService } from "./documentGenerator.service.js";
import { getBriefQuestions } from "../constants/briefQuestions.js";
import { invoiceService } from "./invoice.service.js";
import { emailService } from "./email.service.js";
import { projectApprovedManagerTemplate, projectApprovedClientTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";

export type TimelineStepStatus = "done" | "pending" | "locked";

export interface TimelineStep {
  key: string;
  label: string;
  status: TimelineStepStatus;
  date: string | null;
}

export const projectService = {
  async getAllProjects(userId: string, userRole: Role, options: ListQueryOptions, clientId?: string) {
    return projectRepository.findAll(userId, userRole, options, clientId);
  },

  async getProjectById(id: string, userId: string, userRole: Role, clientId?: string) {
    const project = await projectRepository.findById(id, userId, userRole, clientId);
    if (!project) throw new HttpError(404, "Project not found");
    return project;
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
    return project;
  },

  async updateProject(id: string, data: Partial<CreateProjectDTO>, scope?: ServiceScope) {
    const project = await projectRepository.findByIdAdmin(id);
    if (!project) throw new HttpError(404, "Project not found");
    if (scope?.userRole === "MANAGER" && scope.userServiceId && project.serviceId !== scope.userServiceId) {
      throw new HttpError(404, "Project not found");
    }

    const updated = await projectRepository.update(id, data);

    if (data.status && data.status !== project.status && project.clientId) {
      const clientUsers = await userRepository.findByClientId(project.clientId);
      await enqueueNotifications(clientUsers.map((user) => ({ userId: user.id, title: "Mise à jour du projet", message: `Le projet "${project.name}" est passé à ${data.status}` })));
    }

    const tagsToInvalidate = [cacheTags.company(), cacheTags.dashboard(), cacheTags.project(id)];
    if (project.clientId) tagsToInvalidate.push(cacheTags.client(project.clientId));
    await invalidateTags(tagsToInvalidate);
    return updated;
  },

  async deleteProject(id: string) {
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
    return deleted;
  },

  async archiveProject(id: string) {
    const project = await projectRepository.findByIdAdmin(id);
    if (!project) throw new HttpError(404, "Project not found");
    const archived = await projectRepository.archive(id);
    const tagsToInvalidate = [cacheTags.company(), cacheTags.dashboard(), cacheTags.project(id)];
    if (project.clientId) tagsToInvalidate.push(cacheTags.client(project.clientId));
    await invalidateTags(tagsToInvalidate);
    return archived;
  },

  async getBrief(id: string, role: Role, clientId?: string) {
    const project = await prismaRead.project.findFirst({
      where: { id, ...(role === "CLIENT" ? { clientId: clientId ?? "__none__" } : {}) },
      select: { id: true, name: true, serviceType: true, briefData: true, briefCompleted: true, briefCompletedAt: true, clientId: true },
    });
    if (!project) throw new HttpError(404, "Project not found");
    const questions = getBriefQuestions(project.serviceType);
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
        await documentGeneratorService.generateClientBrief(docProject, docClient, uploadedById);
      } catch (err) {
        console.error("[submitBrief] PDF generation failed:", err);
      }

      try {
        const managers = await userRepository.findAdmins();
        await enqueueNotifications(managers.map((u) => ({ userId: u.id, title: "Brief client complété", message: `Le client a complété son brief pour le projet « ${project.name} ».` })));
      } catch (err) {
        console.error("[submitBrief] Manager notification failed:", err);
      }
    })();

    await invalidateTags([cacheTags.company(), cacheTags.project(id)]);
    return updated;
  },

  async clientApprove(projectId: string, clientId: string, userId: string) {
    const preread = await prismaRead.project.findFirst({
      where: { id: projectId },
      select: { id: true, name: true, clientId: true, status: true, clientApprovedAt: true, budget: true, client: { select: { id: true, name: true, email: true } }, proposal: { select: { amount: true, currency: true } }, invoices: { select: { id: true, title: true } } },
    });
    if (!preread) throw new HttpError(404, "Project not found");
    if (preread.clientId !== clientId) throw new HttpError(403, "Forbidden");
    if (preread.clientApprovedAt) throw new HttpError(409, "Project already approved", "PROJECT_ALREADY_APPROVED");
    if (preread.status === "COMPLETED") throw new HttpError(409, "Project is already completed", "PROJECT_ALREADY_COMPLETED");

    const openTasks = await prismaRead.task.findMany({ where: { projectId, status: { not: "DONE" } }, select: { id: true, title: true, status: true } });
    if (openTasks.length > 0) {
      throw new HttpError(400, `${openTasks.length} tâche(s) non terminée(s)`, "OPEN_TASKS_REMAINING", { tasks: openTasks.map((t) => ({ id: t.id, title: t.title, status: t.status })) });
    }

    const proposalAmount = preread.proposal?.amount != null ? Number(preread.proposal.amount) : 0;
    const balanceAmount = proposalAmount > 0 ? Math.round(proposalAmount * 0.7 * 100) / 100 : 0;
    const currency = preread.proposal?.currency ?? "TND";
    const balanceAlreadyExists = preread.invoices.some((inv) => inv.title.toLowerCase().includes("solde"));

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id: projectId },
        data: { status: "COMPLETED", clientApprovedAt: new Date(), clientApprovedById: userId },
        select: { id: true, name: true, clientId: true },
      });

      let balanceInvoice: { id: string } | null = null;
      if (!balanceAlreadyExists && balanceAmount > 0 && clientId) {
        balanceInvoice = await invoiceService.createBalanceInvoiceTx(tx, {
          title: `Facture de solde : ${preread.name}`,
          description: `Solde restant (70%) pour le projet ${preread.name}`,
          amount: balanceAmount,
          currency,
          clientId,
          projectId,
          dueInDays: 30,
        });
      }

      return { project, balanceInvoiceId: balanceInvoice?.id ?? null };
    });

    void (async () => {
      if (result.balanceInvoiceId) {
        try {
          const inv = await prismaRead.invoice.findUnique({ where: { id: result.balanceInvoiceId }, select: { id: true, number: true, amount: true, currency: true, dueDate: true } });
          if (inv) {
            await documentGeneratorService.generateInvoicePDF(
              { id: inv.id, number: inv.number, amount: inv.amount != null ? Number(inv.amount) : null, currency: inv.currency ?? "TND", dueDate: inv.dueDate },
              { id: projectId, name: preread.name, description: undefined, budget: preread.budget ?? undefined, deadline: undefined, serviceId: null },
              { id: clientId, name: preread.client?.name ?? "Client", email: preread.client?.email ?? undefined },
              userId
            );
          }
        } catch (err) {
          console.error("[clientApprove] Balance invoice PDF generation failed:", err);
        }
      }

      try {
        const managers = await userRepository.findAdmins();
        const dashboardUrl = env.FRONTEND_URL ? `${env.FRONTEND_URL}/app/projects/${projectId}` : `https://app.secritou.com/app/projects/${projectId}`;
        await Promise.all(
          managers.map((u) => {
            const tpl = projectApprovedManagerTemplate({ managerName: u.name ?? u.email, clientName: preread.client?.name ?? clientId, projectName: preread.name, dashboardUrl });
            return emailService.send({ to: u.email, ...tpl });
          })
        );
        await enqueueNotifications(managers.map((u) => ({ userId: u.id, title: "Projet approuvé par le client", message: `Le client ${preread.client?.name ?? ""} a approuvé la livraison du projet « ${preread.name} ». Facture de solde générée.` })));
      } catch (err) {
        console.error("[clientApprove] Manager notification failed:", err);
      }

      try {
        const clientEmail = preread.client?.email;
        if (clientEmail) {
          const portalUrl = env.FRONTEND_URL ? `${env.FRONTEND_URL}/client/invoices` : `https://app.secritou.com/client/invoices`;
          const tpl = projectApprovedClientTemplate({ clientName: preread.client?.name ?? "Client", projectName: preread.name, portalUrl });
          await emailService.send({ to: clientEmail, ...tpl });
        }
      } catch (err) {
        console.error("[clientApprove] Client email failed:", err);
      }
    })();

    await invalidateTags([cacheTags.company(), cacheTags.dashboard(), cacheTags.project(projectId), ...(clientId ? [cacheTags.client(clientId)] : [])]);

    return result;
  },

  async getTimelineStatus(id: string, role: Role, clientId?: string): Promise<TimelineStep[]> {
    const project = await prismaRead.project.findFirst({
      where: { id, ...(role === "CLIENT" ? { clientId: clientId ?? "__none__" } : {}) },
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
