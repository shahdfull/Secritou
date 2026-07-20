import { proposalRepository } from "../repositories/proposal.repository.js";
import logger from "../utils/logger.js";
import { userRepository } from "../repositories/user.repository.js";
import { clientRepository } from "../repositories/client.repository.js";
import { enqueueEmails, enqueueNotifications, enqueueDocumentGeneration } from "../jobs/queues.js";
import type { DocumentJob } from "../jobs/queues.js";
import { proposalSentTemplate, proposalAcceptedTemplate, proposalRejectedTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import type { ProposalStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { HttpError } from "../utils/httpError.js";
import type { ServiceScope } from "../utils/serviceScope.js";
import { prisma } from "../config/prisma.js";
import { invoiceService } from "./invoice.service.js";
import { linkLeadToClientTx } from "./lead.service.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import { roundMoney } from "../utils/vat.js";
import { notifyN8n } from "../utils/webhook.js";
import { managerPermissionService } from "./managerPermission.service.js";

// SEC-099: this used to key off proposal.projectId — the project a proposal is optionally
// created FROM (relation "ProjectProposals"), which is almost always null — instead of
// linkedProject, the project created FROM the proposal once accepted (relation
// "ProjectProposal"). That rejected a MANAGER on every proposal they were themselves allowed to
// create (SEC-028), across the entire post-creation lifecycle (list, read, update, send, accept,
// sections). Derivation now mirrors assertProposalCreationInScope: linkedProject.serviceId is
// authoritative when present (unambiguous — the proposal produced that exact project); otherwise
// fall back to the lead's serviceId, then to the client's existing projects, same "neutral if no
// project, allowed if any project is in-pole, rejected only if EXCLUSIVELY out-of-pole" rule.
async function assertProposalInScope(
  proposal: { clientId: string; leadId: string | null; linkedProject: { serviceId: string | null } | null } | null,
  scope?: ServiceScope
) {
  if (!proposal) throw new HttpError(404, "Proposal not found");
  if (!scope || scope.userRole !== "MANAGER") return;
  if (proposal.linkedProject) {
    if (proposal.linkedProject.serviceId !== scope.userServiceId) throw new HttpError(404, "Proposal not found");
    return;
  }
  const { prismaRead: prisma } = await import("../config/prisma.js");
  if (proposal.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: proposal.leadId }, select: { serviceId: true } });
    if (lead?.serviceId && lead.serviceId !== scope.userServiceId) {
      throw new HttpError(404, "Proposal not found");
    }
  }
  const clientServiceIds = await prisma.project.findMany({
    where: { clientId: proposal.clientId },
    select: { serviceId: true },
    distinct: ["serviceId"],
  });
  const hasAnyProject = clientServiceIds.length > 0;
  const hasProjectInOwnPole = clientServiceIds.some((p) => p.serviceId === scope.userServiceId);
  if (hasAnyProject && !hasProjectInOwnPole) throw new HttpError(404, "Proposal not found");
}

// RG-002 (REFERENTIEL.md §5) / SEC-028: at creation, a proposal has no projectId yet (the
// project is created FROM the accepted proposal), so assertProposalInScope can't apply here —
// it would always reject a MANAGER's own proposal since projectId is null at this point.
// A Client has no fixed pole of its own (a client can have projects across multiple poles), so
// scope is derived the same way ServiceRequest reads are already scoped elsewhere
// (serviceRequest.repository.ts): a client with no project at all is neutral (any Manager may
// start a proposal for it), a client already tied to a project in the Manager's own pole is
// allowed, and a client tied EXCLUSIVELY to another pole's project(s) is rejected. Lead has its
// own serviceId field (no ambiguity), checked directly instead.
async function assertProposalCreationInScope(
  data: { clientId: string; leadId?: string },
  scope?: ServiceScope
) {
  if (!scope || scope.userRole !== "MANAGER") return;
  const { prismaRead: prisma } = await import("../config/prisma.js");

  if (data.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: data.leadId }, select: { serviceId: true } });
    if (lead?.serviceId && lead.serviceId !== scope.userServiceId) {
      throw new HttpError(404, "Lead not found");
    }
  }

  const clientServiceIds = await prisma.project.findMany({
    where: { clientId: data.clientId },
    select: { serviceId: true },
    distinct: ["serviceId"],
  });
  const hasAnyProject = clientServiceIds.length > 0;
  const hasProjectInOwnPole = clientServiceIds.some((p) => p.serviceId === scope.userServiceId);
  if (hasAnyProject && !hasProjectInOwnPole) {
    throw new HttpError(404, "Client not found");
  }
}

async function notifyClientRevertedToDraft(proposal: { id: string; title: string; clientId: string }) {
  const clientUsers = await userRepository.findByClientId(proposal.clientId);
  const viewUrl = `${env.FRONTEND_URL}/client/proposals/${proposal.id}`;
  void enqueueNotifications(
    clientUsers.map((user) => ({
      userId: user.id,
      title: "Proposition modifiée",
      message: `La proposition "${proposal.title}" a été modifiée et doit être renvoyée. Veuillez consulter la version la plus récente.`,
      type: "PROPOSAL_UPDATED" as const,
      entityId: proposal.id,
      link: viewUrl,
    }))
  );
}

async function revertParentToDraftById(parent: { id: string; status: ProposalStatus; version: number; title: string; clientId: string }, change: "edited" | "deleted", userId?: string) {
  if (parent.status !== "SENT" && parent.status !== "VIEWED") return;
  const updated = await proposalRepository.update(parent.id, { status: "DRAFT", version: parent.version + 1 });
  await proposalRepository.addHistory(parent.id, {
    action: "REVERTED_TO_DRAFT",
    comment: `Section ${change} while ${parent.status}; reverted to DRAFT (v${parent.version} → v${updated?.version}). Must be re-sent.`,
    userId,
  });
  await notifyClientRevertedToDraft({ id: parent.id, title: parent.title, clientId: parent.clientId });
}

async function revertParentToDraftIfLive(sectionId: string, change: "edited" | "deleted", userId?: string) {
  const parent = await proposalRepository.findProposalBySectionId(sectionId);
  if (parent) await revertParentToDraftById(parent, change, userId);
}

// Recipients for the "proposal accepted" alert: every ADMIN (direction), plus only the
// pole's MANAGER(s) — and among those, only ones whose resolved permissions actually grant
// proposals.read (a manager can be assigned to the right pole yet still have that module
// disabled via PermissionProfile/overrides).
async function resolveAcceptedProposalRecipients(serviceId: string | null) {
  const staff = await userRepository.findAdminsAndPoleManagers(serviceId);
  const checks = await Promise.all(
    staff.map(async (user) => {
      if (user.role === "ADMIN") return user;
      const permissions = await managerPermissionService.resolvePermissions(user.id);
      return permissions?.proposals?.read ? user : null;
    })
  );
  return checks.filter((u): u is NonNullable<typeof u> => u !== null);
}

async function notifyAdminsAccepted(proposal: { id: string; title: string; amount: unknown; currency: string | null; clientId: string; serviceId: string | null }) {
  const [recipients, client, clientUsers] = await Promise.all([
    resolveAcceptedProposalRecipients(proposal.serviceId),
    clientRepository.findById(proposal.clientId),
    userRepository.findByClientId(proposal.clientId),
  ]);
  const dashboardUrl = `${env.FRONTEND_URL}/app/commercial?tab=proposals`;
  const clientUrl = `${env.FRONTEND_URL}/client/proposals/${proposal.id}`;
  const currency = proposal.currency ?? "TND";
  void Promise.all([
    enqueueEmails(
      recipients.map((recipient) => {
        const { subject, html } = proposalAcceptedTemplate(
          recipient.name ?? "Admin",
          proposal.title,
          client?.name ?? "Le client",
          proposal.amount != null ? Number(proposal.amount) : null,
          currency,
          dashboardUrl
        );
        return { to: recipient.email, subject, html };
      })
    ),
    enqueueNotifications(recipients.map((recipient) => ({
      userId: recipient.id,
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

  return recipients;
}

export const proposalService = {
  async getAllByClientId(clientId: string, options: { page: number; pageSize: number; status?: ProposalStatus }) {
    return proposalRepository.findAllByClientId(clientId, options);
  },

  async getByIdForClient(id: string, clientId: string) {
    return proposalRepository.findByIdForClient(id, clientId);
  },

  async markViewed(id: string, clientId: string) {
    const proposal = await proposalRepository.findByIdForClient(id, clientId);
    if (!proposal) throw new HttpError(404, "Proposal not found");

    if (proposal.status !== "SENT") return proposal;

    const now = new Date();
    const updated = await proposalRepository.update(id, { status: "VIEWED", viewedAt: now });

    const admins = await userRepository.findAdmins();
    const adminLink = `${env.FRONTEND_URL}/app/commercial?tab=proposals`;
    void enqueueNotifications(
      admins.map((admin) => ({
        userId: admin.id,
        title: "Proposition consultée",
        message: `Le client a consulté la proposition "${proposal.title}".`,
        type: "PROPOSAL_VIEWED" as const,
        entityId: id,
        link: adminLink,
      }))
    );

    return updated;
  },

  async getAll(options: ListQueryOptions & { clientId?: string; status?: ProposalStatus; search?: string }, scope?: ServiceScope) {
    const serviceId = scope?.userRole === "MANAGER" ? (scope.userServiceId ?? "__none__") : undefined;
    return proposalRepository.findAll({ ...options, serviceId });
  },

  async getById(id: string, scope?: ServiceScope) {
    const proposal = await proposalRepository.findById(id);
    await assertProposalInScope(proposal, scope);
    return proposal;
  },

  async create(data: { title: string; description?: string; amount?: number; currency?: string; expiresAt?: Date; pdfUrl?: string; clientId: string; clientName?: string; email?: string; projectId?: string; serviceRequestId?: string; leadId?: string }, scope?: ServiceScope) {
    await assertProposalCreationInScope(data, scope);
    return prisma.$transaction(async (tx) => {
      if (data.serviceRequestId) {
        const serviceRequest = await tx.serviceRequest.findFirst({
          where: { id: data.serviceRequestId },
          select: { id: true, type: true, proposal: { select: { id: true } } },
        });
        if (!serviceRequest) throw new HttpError(404, "Service request not found");
        if (serviceRequest.type !== "NEW_PROJECT") throw new HttpError(422, "Support requests cannot generate proposals", "SERVICE_REQUEST_NOT_PROPOSABLE");
        if (serviceRequest.proposal) throw new HttpError(409, "Service request already linked to a proposal", "SERVICE_REQUEST_ALREADY_LINKED");
      }

      if (data.leadId) {
        const lead = await tx.lead.findUnique({
          where: { id: data.leadId },
          select: { id: true, status: true, convertedClientId: true, convertedClient: { select: { id: true } } },
        });
        if (!lead) throw new HttpError(404, "Lead not found");
        if (lead.convertedClientId) throw new HttpError(422, "Lead already converted", "LEAD_ALREADY_CONVERTED");
        if (lead.status === "WON") throw new HttpError(422, "Lead is already won", "LEAD_ALREADY_WON");
        // Prevent cross-client contamination: the lead must belong to the same client as the proposal
        if (lead.convertedClient && lead.convertedClient.id !== data.clientId) {
          throw new HttpError(422, "Lead does not belong to this client", "LEAD_CLIENT_MISMATCH");
        }

        await tx.lead.update({
          where: { id: data.leadId },
          data: { status: "PROPOSAL" },
        });
      }

      return tx.proposal.create({ data });
    });
  },

  async update(id: string, data: Prisma.ProposalUncheckedUpdateInput, userId?: string, scope?: ServiceScope) {
    const proposal = await proposalRepository.findById(id);
    await assertProposalInScope(proposal, scope);
    if (!proposal) throw new HttpError(404, "Proposal not found");

    const isLive = proposal.status === "SENT" || proposal.status === "VIEWED";
    const contentChanged =
      (data.title !== undefined && data.title !== proposal.title) ||
      (data.description !== undefined && data.description !== proposal.description) ||
      (data.amount !== undefined && Number(data.amount) !== (proposal.amount != null ? Number(proposal.amount) : null)) ||
      (data.currency !== undefined && data.currency !== proposal.currency) ||
      // instanceof Date guard: Prisma.ProposalUncheckedUpdateInput allows expiresAt to be a
      // NullableDateTimeFieldUpdateOperationsInput ({ set: ... }), not just a plain Date — every
      // real call site (controller) passes a plain Date, so the guard never actually skips a
      // real change, it only satisfies the wider type.
      (data.expiresAt !== undefined && data.expiresAt instanceof Date &&
        (proposal.expiresAt == null || data.expiresAt.getTime() !== proposal.expiresAt.getTime()));

    if (isLive && contentChanged && data.status === undefined) {
      const updated = await proposalRepository.update(id, { ...data, status: "DRAFT", version: proposal.version + 1 });
      await proposalRepository.addHistory(id, {
        action: "REVERTED_TO_DRAFT",
        comment: `Content edited while ${proposal.status}; reverted to DRAFT (v${proposal.version} → v${updated?.version}). Must be re-sent.`,
        userId,
      });
      await notifyClientRevertedToDraft({ id: proposal.id, title: proposal.title, clientId: proposal.clientId });
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

  async send(id: string, uploadedById: string, scope?: ServiceScope) {
    const proposal = await proposalRepository.findById(id);
    await assertProposalInScope(proposal, scope);
    const updated = await proposalRepository.update(id, { status: "SENT" });

    if (proposal) {
      // Generate quote PDF
      const client = await clientRepository.findById(proposal.clientId);
      if (client) {
        const project = proposal.projectId
          ? { id: proposal.projectId, name: proposal.title, description: proposal.description, budget: proposal.amount?.toString(), deadline: proposal.expiresAt, serviceId: null }
          : null;

        void enqueueDocumentGeneration([
          {
            kind: "quote",
            proposal: {
              id: proposal.id,
              title: proposal.title,
              description: proposal.description,
              amount: proposal.amount != null ? Number(proposal.amount) : null,
              currency: proposal.currency,
              expiresAt: proposal.expiresAt,
            },
            project,
            client: { id: client.id, name: client.name, email: client.email },
            uploadedById,
          },
        ]);
      }

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

  // SEC-134: the internal try/catch on the Project/Invoice unique-constraint collision (inside
  // acceptWithCascadeAttempt below) can never actually recover within the SAME transaction —
  // once Postgres raises an error inside a transaction block, that transaction is aborted and
  // every subsequent statement fails with 25P02 until ROLLBACK, so the "read the winner's row
  // instead" fallback always itself throws in the exact race it exists to handle. The
  // transaction as a whole rolls back and the error surfaces up here; retrying the whole call
  // once is what actually recovers, because the retry starts a brand-new transaction that will
  // find proposal.status === "ACCEPTED" (and linkedProject/invoice already populated) and simply
  // return the winner's IDs instead of racing to create anything again.
  async acceptWithCascade(id: string, expectedVersion?: number, uploadedById?: string) {
    try {
      return await proposalService.acceptWithCascadeAttempt(id, expectedVersion, uploadedById);
    } catch (err) {
      // P2002: the losing side's own tx.project.create/tx.invoice.create hit the unique
      // constraint. P2010/25P02 (Prisma wraps the raw Postgres code as P2010's `meta.code`): the
      // in-transaction fallback (tx.project.findFirst / tx.invoice.findFirst, meant to read the
      // winner's row) itself failed, because Postgres refuses every further statement once a
      // transaction has errored — the exact "aborted transaction" case this retry exists for.
      const isRecoverableRaceError =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === "P2002" || (err.code === "P2010" && (err.meta as { code?: string } | undefined)?.code === "25P02"));
      if (isRecoverableRaceError) {
        return proposalService.acceptWithCascadeAttempt(id, expectedVersion, uploadedById);
      }
      throw err;
    }
  },

  async acceptWithCascadeAttempt(id: string, expectedVersion?: number, uploadedById?: string) {
    const result = await prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.findUnique({
        where: { id },
        include: {
          linkedProject: { select: { id: true, serviceId: true } },
          invoice: { select: { id: true } },
          project: { select: { serviceId: true } },
          lead: { select: { id: true } },
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

      // If this proposal was linked to a lead, mark the lead as WON and auto-convert it to the
      // proposal's (already-existing) client, so the manual "Convert to Client" button becomes
      // a no-op for this lead going forward.
      if (proposal.leadId) {
        await tx.lead.update({
          where: { id: proposal.leadId },
          data: { status: "WON" },
        });
        await linkLeadToClientTx(tx, proposal.leadId, proposal.clientId);
      }

      // The pole (Service) this proposal belongs to — used after the transaction to scope
      // the "proposal accepted" alert to the pole's manager(s) instead of every manager.
      const serviceId = proposal.linkedProject?.serviceId ?? proposal.project?.serviceId ?? null;

      let projectId = proposal.linkedProject?.id ?? null;
      if (!projectId) {
        try {
          const project = await tx.project.create({
            data: {
              name: proposal.title,
              description: proposal.description ?? undefined,
              status: "PLANNING",
              clientId: proposal.clientId,
              serviceId: serviceId ?? undefined,
              proposalId: proposal.id,
              budget: proposal.amount != null ? String(proposal.amount) : undefined,
              deadline: proposal.expiresAt ?? undefined,
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
      if (!invoiceId && proposal.amount != null && Number(proposal.amount) > 0) {
        const depositAmount = roundMoney(Number(proposal.amount) * 0.3);
        try {
          const invoice = await invoiceService.createDepositInvoiceTx(tx, {
            title: `Acompte 30% : ${proposal.title}`,
            description: proposal.description ?? undefined,
            amountHT: depositAmount,
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
      } else if (!invoiceId) {
        // proposal.amount is null or zero — no deposit invoice created (intentional for quote-less proposals).
        logger.warn({ proposalId: id }, "[acceptWithCascade] proposal has no amount or amount is zero — skipping deposit invoice creation");
      }

      return { proposalId: id, clientId: proposal.clientId, title: proposal.title, amount: proposal.amount, currency: proposal.currency, clientName: proposal.clientName, email: proposal.email, projectId, invoiceId, serviceId };
    });

    const notified = await notifyAdminsAccepted({ id: result.proposalId, title: result.title, amount: result.amount, currency: result.currency, clientId: result.clientId, serviceId: result.serviceId });
    await invalidateTags([cacheTags.company(), cacheTags.dashboard(), cacheTags.client(result.clientId)]);

    // RG-018 / SEC-002: the client portal account (and its invitation email) is no longer
    // created here. It's created when the DEPOSIT invoice actually reaches PAID
    // (invoice.service.ts#addPayment) — Cadrage §6: "paiement de la 1re tranche = ouverture
    // de l'espace client". Accepting a proposal only generates the deposit invoice; it does
    // not by itself grant the client any account or credentials.
    const client = await clientRepository.findById(result.clientId);

    const proposal = await proposalRepository.findById(id);

    if (result.projectId && uploadedById) {
      const docProject = { id: result.projectId, name: result.title, description: proposal?.description ?? undefined, budget: proposal?.amount != null ? String(proposal.amount) : undefined, deadline: proposal?.expiresAt ?? undefined, serviceId: null as string | null };
      const docClient = client ?? { id: result.clientId, name: result.clientName ?? "Client", email: result.email ?? undefined };
      const manager = await userRepository.findById(uploadedById).catch(() => null);
      const docManager = manager ? { id: manager.id, name: manager.name ?? undefined, email: manager.email } : { id: uploadedById, name: undefined, email: "" };
      const docProposal = { id, title: result.title, description: proposal?.description ?? undefined, amount: result.amount != null ? Number(result.amount) : null, currency: result.currency, expiresAt: proposal?.expiresAt ?? undefined };

      const documentJobs: DocumentJob[] = [
        { kind: "welcomeLetter", proposal: docProposal, project: docProject, client: docClient, manager: docManager, uploadedById },
        { kind: "contract", proposal: docProposal, project: docProject, client: docClient, uploadedById },
        { kind: "specs", project: docProject, client: docClient, uploadedById },
        { kind: "clientBrief", project: docProject, client: docClient, uploadedById },
        { kind: "quote", proposal: docProposal, project: docProject, client: docClient, uploadedById },
        { kind: "roadmap", project: docProject, uploadedById },
      ];

      if (result.invoiceId) {
        const { prismaRead } = await import("../config/prisma.js");
        const inv = await prismaRead.invoice.findUnique({ where: { id: result.invoiceId }, select: { id: true, number: true, amount: true, amountHT: true, tvaRate: true, tvaAmount: true, currency: true, dueDate: true } });
        if (inv) {
          documentJobs.push({
            kind: "invoice",
            invoice: {
              ...inv,
              amount: inv.amount != null ? Number(inv.amount) : null,
              amountHT: inv.amountHT != null ? Number(inv.amountHT) : null,
              tvaRate: inv.tvaRate != null ? Number(inv.tvaRate) : null,
              tvaAmount: inv.tvaAmount != null ? Number(inv.tvaAmount) : null,
            },
            project: docProject,
            client: docClient,
            uploadedById,
          });
        }
      }

      await enqueueDocumentGeneration(documentJobs);
    }

    void notifyN8n("proposal.accepted", {
      proposalId: result.proposalId,
      title: result.title,
      amount: result.amount != null ? Number(result.amount) : null,
      currency: result.currency,
      clientId: result.clientId,
      clientName: client?.name ?? result.clientName,
      projectId: result.projectId,
      adminUrl: `${env.FRONTEND_URL}/app/proposals/${result.proposalId}`,
      // Agency inbox (always) + the exact internal recipients Secritou's own RBAC already
      // resolved for this event (ADMIN + pole manager(s) with proposals.read) — n8n sends to
      // this list as-is rather than re-deriving "who can see this" itself.
      agencyEmail: env.CONTACT_RECEIVER_EMAIL,
      internalRecipients: notified.map((r) => ({ name: r.name, email: r.email, role: r.role })),
    });

    // clientInvited is always false here now (RG-018/SEC-002: invitation moved to payment
    // time, see invoice.service.ts#addPayment) — kept in the response shape rather than
    // removed, since the client type/i18n string still exist and a future decision might
    // want to distinguish "already had an account" from "invited by this action".
    return { proposal, projectId: result.projectId, invoiceId: result.invoiceId, clientInvited: false };
  },

  async reject(id: string, comment?: string) {
    const proposal = await proposalRepository.findById(id);
    if (!proposal) throw new HttpError(404, "Proposal not found");
    if (!["SENT", "VIEWED"].includes(proposal.status)) {
      throw new HttpError(409, `Cannot reject a ${proposal.status} proposal`, "INVALID_PROPOSAL_TRANSITION");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedProposal = await tx.proposal.update({
        where: { id },
        data: { status: "REJECTED", rejectedAt: new Date() },
      });

      // Update linked service request to CANCELLED if it exists
      if (proposal.serviceRequestId) {
        await tx.serviceRequest.update({
          where: { id: proposal.serviceRequestId },
          data: { status: "CANCELLED" },
        });
      }

      return updatedProposal;
    });

    const [admins, client] = await Promise.all([
      userRepository.findAdmins(),
      clientRepository.findById(proposal.clientId),
    ]);
    const adminLink = `${env.FRONTEND_URL}/app/commercial?tab=proposals`;
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
