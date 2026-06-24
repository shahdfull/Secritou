import { proposalRepository } from "../repositories/proposal.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { clientRepository } from "../repositories/client.repository.js";
import { enqueueEmail, enqueueEmails, enqueueNotifications } from "../jobs/queues.js";
import { proposalSentTemplate, proposalAcceptedTemplate, proposalRejectedTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import type { ProposalStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { HttpError } from "../utils/httpError.js";
import type { ServiceScope } from "../utils/serviceScope.js";
import { prisma } from "../config/prisma.js";
import { invoiceService } from "./invoice.service.js";
import { clientService } from "./client.service.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import { documentGeneratorService } from "./documentGenerator.service.js";

// A MANAGER may only see/act on a proposal whose project is in their service. A proposal with
// no project is ADMIN-only. Throws 404 (not 403) to avoid revealing existence of out-of-scope proposals.
async function assertProposalInScope(proposal: { projectId: string | null } | null, scope?: ServiceScope) {
  if (!proposal) throw new HttpError(404, "Proposal not found");
  if (!scope || scope.userRole !== "MANAGER") return;
  if (!proposal.projectId) throw new HttpError(404, "Proposal not found");
  const { prismaRead: prisma } = await import("../config/prisma.js");
  const project = await prisma.project.findFirst({
    where: { id: proposal.projectId, serviceId: scope.userServiceId ?? "__none__" },
    select: { id: true },
  });
  if (!project) throw new HttpError(404, "Proposal not found");
}

async function revertParentToDraftById(parent: { id: string; status: ProposalStatus; version: number }, change: "edited" | "deleted", userId?: string) {
  if (parent.status !== "SENT" && parent.status !== "VIEWED") return;
  const updated = await proposalRepository.update(parent.id, { status: "DRAFT", version: parent.version + 1 });
  await proposalRepository.addHistory(parent.id, {
    action: "REVERTED_TO_DRAFT",
    comment: `Section ${change} while ${parent.status}; reverted to DRAFT (v${parent.version} → v${updated?.version}). Must be re-sent.`,
    userId,
  });
}

async function revertParentToDraftIfLive(sectionId: string, change: "edited" | "deleted", userId?: string) {
  const parent = await proposalRepository.findProposalBySectionId(sectionId);
  if (parent) await revertParentToDraftById(parent, change, userId);
}

async function notifyAdminsAccepted(proposal: { id: string; title: string; amount: unknown; currency: string | null; clientId: string }) {
  const [admins, client, clientUsers] = await Promise.all([
    userRepository.findAdmins(),
    clientRepository.findById(proposal.clientId),
    userRepository.findByClientId(proposal.clientId),
  ]);
  const dashboardUrl = `${env.FRONTEND_URL}/app/proposals/${proposal.id}`;
  const clientUrl = `${env.FRONTEND_URL}/client/proposals/${proposal.id}`;
  const currency = proposal.currency ?? "TND";
  void Promise.all([
    enqueueEmails(
      admins.map((admin) => {
        const { subject, html } = proposalAcceptedTemplate(
          admin.name ?? "Admin",
          proposal.title,
          client?.name ?? "Le client",
          proposal.amount != null ? Number(proposal.amount) : null,
          currency,
          dashboardUrl
        );
        return { to: admin.email, subject, html };
      })
    ),
    enqueueNotifications(admins.map((admin) => ({
      userId: admin.id,
      title: "Proposition acceptée",
      message: `${client?.name ?? "Le client"} a accepté la proposition "${proposal.title}".`,
      type: "PROPOSAL_ACCEPTED" as const,
      entityId: proposal.id,
      link: dashboardUrl,
    }))),
    enqueueNotifications(clientUsers.map((user) => ({
      userId: user.id,
      title: "Proposition acceptée",
      message: `Vous avez accepté la proposition "${proposal.title}". Un projet et une facture ont été créés.`,
      type: "PROPOSAL_ACCEPTED" as const,
      entityId: proposal.id,
      link: clientUrl,
    }))),
  ]);
}

export const proposalService = {
  async getAllByClientId(clientId: string, options: { page: number; pageSize: number; status?: ProposalStatus }) {
    return proposalRepository.findAllByClientId(clientId, options);
  },

  async getByIdForClient(id: string, clientId: string) {
    return proposalRepository.findByIdForClient(id, clientId);
  },

  async getAll(options: ListQueryOptions & { clientId?: string; status?: ProposalStatus; search?: string }, scope?: ServiceScope) {
    const serviceId = scope?.userRole === "MANAGER" ? (scope.userServiceId ?? "__none__") : undefined;
    return proposalRepository.findAll({ ...options, serviceId });
  },

  async getById(id: string, scope?: ServiceScope) {
    const proposal = await proposalRepository.findById(id);
    assertProposalInScope(proposal, scope);
    return proposal;
  },

  async create(data: { title: string; description?: string; amount?: number; currency?: string; expiresAt?: Date; pdfUrl?: string; clientId: string; clientName?: string; email?: string; projectId?: string; serviceRequestId?: string }) {
    if (data.serviceRequestId) {
      const serviceRequest = await prisma.serviceRequest.findFirst({
        where: { id: data.serviceRequestId },
        select: { id: true, type: true, proposal: { select: { id: true } } },
      });
      if (!serviceRequest) throw new HttpError(404, "Service request not found");
      if (serviceRequest.type !== "NEW_PROJECT") throw new HttpError(422, "Support requests cannot generate proposals", "SERVICE_REQUEST_NOT_PROPOSABLE");
      if (serviceRequest.proposal) throw new HttpError(409, "Service request already linked to a proposal", "SERVICE_REQUEST_ALREADY_LINKED");
    }
    return proposalRepository.create(data);
  },

  async update(id: string, data: Partial<{ title: string; description: string; status: ProposalStatus; amount: number; currency: string; expiresAt: Date; pdfUrl: string }>, userId?: string, scope?: ServiceScope) {
    const proposal = await proposalRepository.findById(id);
    await assertProposalInScope(proposal, scope);
    if (!proposal) throw new HttpError(404, "Proposal not found");

    const isLive = proposal.status === "SENT" || proposal.status === "VIEWED";
    const contentChanged =
      (data.title !== undefined && data.title !== proposal.title) ||
      (data.description !== undefined && data.description !== proposal.description) ||
      (data.amount !== undefined && Number(data.amount) !== (proposal.amount != null ? Number(proposal.amount) : null));

    if (isLive && contentChanged && data.status === undefined) {
      const updated = await proposalRepository.update(id, { ...data, status: "DRAFT", version: proposal.version + 1 });
      await proposalRepository.addHistory(id, {
        action: "REVERTED_TO_DRAFT",
        comment: `Content edited while ${proposal.status}; reverted to DRAFT (v${proposal.version} → v${updated?.version}). Must be re-sent.`,
        userId,
      });
      return updated;
    }

    return proposalRepository.update(id, data);
  },

  async delete(id: string) {
    const proposal = await proposalRepository.findById(id);
    if (!proposal) throw new HttpError(404, "Proposal not found");
    if (proposal.linkedProject) {
      throw new HttpError(409, "Cannot delete a proposal that has generated a project");
    }
    if (proposal.invoice) {
      throw new HttpError(409, "Cannot delete a proposal that has a linked invoice");
    }
    return proposalRepository.delete(id);
  },

  async send(id: string, scope?: ServiceScope) {
    const proposal = await proposalRepository.findById(id);
    await assertProposalInScope(proposal, scope);
    const updated = await proposalRepository.update(id, { status: "SENT" });

    if (proposal) {
      const clientUsers = await userRepository.findByClientId(proposal.clientId);
      const viewUrl = `${env.FRONTEND_URL}/client/proposals/${id}`;
      const currency = proposal.currency ?? "TND";
      void Promise.all([
        enqueueEmails(
          clientUsers.map((user) => {
            const { subject, html } = proposalSentTemplate(user.name ?? "Client", proposal.title, proposal.amount != null ? Number(proposal.amount) : null, currency, viewUrl);
            return { to: user.email, subject, html };
          })
        ),
        enqueueNotifications(
          clientUsers.map((user) => ({
            userId: user.id,
            title: "Nouvelle proposition",
            message: `Une proposition "${proposal.title}" vous a été envoyée.`,
            type: "PROPOSAL_SENT" as const,
            entityId: id,
            link: viewUrl,
          }))
        ),
      ]);
    }

    return updated;
  },

  async accept(id: string, expectedVersion?: number) {
    const proposal = await proposalRepository.findById(id);
    if (!proposal) throw new HttpError(404, "Proposal not found");
    if (expectedVersion !== undefined && expectedVersion !== proposal.version) {
      throw new HttpError(409, "This proposal was updated since you opened it. Please review the latest version.", "PROPOSAL_VERSION_MISMATCH", { currentVersion: proposal.version });
    }
    if (!["SENT", "VIEWED"].includes(proposal.status)) {
      throw new HttpError(409, `Cannot accept a ${proposal.status} proposal`, "INVALID_PROPOSAL_TRANSITION");
    }
    if (proposal.expiresAt && proposal.expiresAt < new Date()) {
      throw new HttpError(409, "This proposal has expired", "PROPOSAL_EXPIRED");
    }
    const updated = await proposalRepository.update(id, { status: "ACCEPTED", acceptedAt: new Date() });
    await notifyAdminsAccepted({ id, title: proposal.title, amount: proposal.amount, currency: proposal.currency, clientId: proposal.clientId });
    return updated;
  },

  async acceptWithCascade(id: string, expectedVersion?: number, uploadedById?: string) {
    const result = await prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.findUnique({
        where: { id },
        include: {
          linkedProject: { select: { id: true, serviceId: true } },
          invoice: { select: { id: true } },
          project: { select: { serviceId: true } },
        },
      });
      if (!proposal) throw new HttpError(404, "Proposal not found");

      const alreadyAccepted = proposal.status === "ACCEPTED";
      if (!alreadyAccepted) {
        if (expectedVersion !== undefined && expectedVersion !== proposal.version) {
          throw new HttpError(409, "This proposal was updated since you opened it. Please review the latest version.", "PROPOSAL_VERSION_MISMATCH", { currentVersion: proposal.version });
        }
        if (!["SENT", "VIEWED"].includes(proposal.status)) {
          throw new HttpError(409, `Cannot accept a ${proposal.status} proposal`, "INVALID_PROPOSAL_TRANSITION");
        }
        if (proposal.expiresAt && proposal.expiresAt < new Date()) {
          throw new HttpError(409, "This proposal has expired", "PROPOSAL_EXPIRED");
        }
        await tx.proposal.update({ where: { id }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
      }

      let projectId = proposal.linkedProject?.id ?? null;
      if (!projectId) {
        const serviceId = proposal.project?.serviceId ?? undefined;
        try {
          const project = await tx.project.create({
            data: {
              name: proposal.title,
              description: proposal.description ?? undefined,
              status: "PLANNING",
              clientId: proposal.clientId,
              serviceId,
              proposalId: proposal.id,
              budget: proposal.amount != null ? String(proposal.amount) : undefined,
              deadline: undefined,
            },
            select: { id: true },
          });
          projectId = project.id;
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            const existing = await tx.project.findFirst({ where: { proposalId: proposal.id }, select: { id: true } });
            projectId = existing?.id ?? null;
          } else {
            throw err;
          }
        }
      }

      let invoiceId = proposal.invoice?.id ?? null;
      if (!invoiceId && proposal.amount != null) {
        const depositAmount = Math.round(Number(proposal.amount) * 0.3 * 100) / 100;
        try {
          const invoice = await invoiceService.createDepositInvoiceTx(tx, {
            title: `Acompte 30% : ${proposal.title}`,
            description: proposal.description ?? undefined,
            amount: depositAmount,
            currency: proposal.currency,
            clientId: proposal.clientId,
            projectId: projectId ?? undefined,
            proposalId: proposal.id,
            dueInDays: 14,
          });
          invoiceId = invoice.id;
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            const existing = await tx.invoice.findFirst({ where: { proposalId: proposal.id }, select: { id: true } });
            invoiceId = existing?.id ?? null;
          } else {
            throw err;
          }
        }
      }

      return { proposalId: id, clientId: proposal.clientId, title: proposal.title, amount: proposal.amount, currency: proposal.currency, clientName: proposal.clientName, email: proposal.email, projectId, invoiceId };
    });

    await notifyAdminsAccepted({ id: result.proposalId, title: result.title, amount: result.amount, currency: result.currency, clientId: result.clientId });
    await invalidateTags([cacheTags.company(), cacheTags.dashboard(), cacheTags.client(result.clientId)]);

    let clientInvited = false;
    const client = await clientRepository.findById(result.clientId);
    const inviteEmail = result.email ?? client?.email ?? undefined;
    const inviteName = result.clientName ?? client?.name ?? undefined;
    if (inviteEmail && inviteName) {
      try {
        await clientService.inviteClientUser(result.clientId, inviteEmail, inviteName);
        clientInvited = true;
      } catch (err) {
        if (!(err instanceof HttpError && err.statusCode === 409)) throw err;
      }
    }

    const proposal = await proposalRepository.findById(id);

    if (result.projectId && uploadedById) {
      const docProject = { id: result.projectId, name: result.title, description: proposal?.description ?? undefined, budget: proposal?.amount != null ? String(proposal.amount) : undefined, deadline: proposal?.expiresAt ?? undefined, serviceId: null as string | null };
      const docClient = client ?? { id: result.clientId, name: result.clientName ?? "Client", email: result.email ?? undefined };
      const manager = await userRepository.findById(uploadedById).catch(() => null);
      const docManager = manager ? { id: manager.id, name: manager.name ?? undefined, email: manager.email } : { id: uploadedById, name: undefined, email: "" };
      const docProposal = { id, title: result.title, description: proposal?.description ?? undefined, amount: result.amount != null ? Number(result.amount) : null, currency: result.currency, expiresAt: proposal?.expiresAt ?? undefined };

      void Promise.allSettled([
        documentGeneratorService.generateWelcomeLetter(docProposal, docProject, docClient, docManager, uploadedById),
        documentGeneratorService.generateContract(docProposal, docProject, docClient, uploadedById),
        documentGeneratorService.generateSpecs(docProject, docClient, uploadedById),
        documentGeneratorService.generateClientBrief(docProject, docClient, uploadedById),
        documentGeneratorService.generateQuotePDF(docProposal, docProject, docClient, uploadedById),
        ...(result.invoiceId
          ? [(async () => {
              const { prismaRead } = await import("../config/prisma.js");
              const inv = await prismaRead.invoice.findUnique({ where: { id: result.invoiceId! }, select: { id: true, number: true, amount: true, currency: true, dueDate: true } });
              if (!inv) return;
              return documentGeneratorService.generateInvoicePDF({ ...inv, amount: inv.amount != null ? Number(inv.amount) : null }, docProject, docClient, uploadedById);
            })()]
          : []),
        documentGeneratorService.generateRoadmap(docProject, uploadedById),
      ]).then((results) => {
        results.forEach((r, i) => { if (r.status === "rejected") console.error(`[documentGenerator] PDF #${i} failed:`, r.reason); });
      });
    }

    return { proposal, projectId: result.projectId, invoiceId: result.invoiceId, clientInvited };
  },

  async reject(id: string, comment?: string) {
    const proposal = await proposalRepository.findById(id);
    if (!proposal) throw new HttpError(404, "Proposal not found");
    if (!["SENT", "VIEWED"].includes(proposal.status)) {
      throw new HttpError(409, `Cannot reject a ${proposal.status} proposal`, "INVALID_PROPOSAL_TRANSITION");
    }
    const updated = await proposalRepository.update(id, { status: "REJECTED", rejectedAt: new Date() });

    const [admins, client] = await Promise.all([
      userRepository.findAdmins(),
      clientRepository.findById(proposal.clientId),
    ]);
    const adminLink = `${env.FRONTEND_URL}/app/proposals/${id}`;
    const clientUsers = await userRepository.findByClientId(proposal.clientId);
    void Promise.all([
      enqueueEmails(
        admins.map((admin) => {
          const { subject, html } = proposalRejectedTemplate(admin.name ?? "Admin", proposal.title, client?.name ?? "Le client", comment);
          return { to: admin.email, subject, html };
        })
      ),
      enqueueNotifications(admins.map((admin) => ({
        userId: admin.id,
        title: "Proposition refusée",
        message: `${client?.name ?? "Le client"} a refusé la proposition "${proposal.title}".`,
        type: "PROPOSAL_REJECTED" as const,
        entityId: id,
        link: adminLink,
      }))),
      enqueueNotifications(clientUsers.map((user) => ({
        userId: user.id,
        title: "Proposition refusée",
        message: `Vous avez refusé la proposition "${proposal.title}".`,
        type: "PROPOSAL_REJECTED" as const,
        entityId: id,
        link: `${env.FRONTEND_URL}/client/proposals/${id}`,
      }))),
    ]);

    return updated;
  },

  async addSection(proposalId: string, data: { title: string; content?: string; orderIndex: number }, scope?: ServiceScope) {
    const proposal = await proposalRepository.findById(proposalId);
    await assertProposalInScope(proposal, scope);
    return proposalRepository.addSection(proposalId, data);
  },

  async updateSection(id: string, data: { title?: string; content?: string; orderIndex?: number }, userId?: string, scope?: ServiceScope) {
    const parent = await proposalRepository.findProposalBySectionId(id);
    await assertProposalInScope(parent, scope);
    const result = await proposalRepository.updateSection(id, data);
    await revertParentToDraftIfLive(id, "edited", userId);
    return result;
  },

  async deleteSection(id: string, userId?: string, scope?: ServiceScope) {
    const parent = await proposalRepository.findProposalBySectionId(id);
    await assertProposalInScope(parent, scope);
    const result = await proposalRepository.deleteSection(id);
    if (parent) await revertParentToDraftById(parent, "deleted", userId);
    return result;
  },

  async addHistory(proposalId: string, data: { action: string; comment?: string; userId?: string }) {
    return proposalRepository.addHistory(proposalId, data);
  },
};
