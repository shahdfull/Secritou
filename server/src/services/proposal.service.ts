import { proposalRepository } from "../repositories/proposal.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { clientRepository } from "../repositories/client.repository.js";
import { enqueueEmail, enqueueEmails } from "../jobs/queues.js";
import {
  proposalSentTemplate,
  proposalAcceptedTemplate,
  proposalRejectedTemplate,
} from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import type { ProposalStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { tenantValidation } from "./tenantValidation.service.js";
import { HttpError } from "../utils/httpError.js";
import type { ServiceScope } from "../utils/serviceScope.js";
import { prisma } from "../config/prisma.js";
import { invoiceService } from "./invoice.service.js";
import { clientService } from "./client.service.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import { documentGeneratorService } from "./documentGenerator.service.js";

// A MANAGER may only see/act on a proposal whose project is in their service. A proposal with
// no project is ADMIN-only. ADMIN is unrestricted. Throws 404 (not 403) to avoid revealing
// the existence of out-of-scope proposals.
async function assertProposalInScope(
  proposal: { projectId: string | null; companyId: string } | null,
  scope?: ServiceScope
) {
  if (!proposal) throw new HttpError(404, "Proposal not found");
  if (!scope || scope.userRole !== "MANAGER") return;
  if (!proposal.projectId) throw new HttpError(404, "Proposal not found");
  const { prismaRead: prisma } = await import("../config/prisma.js");
  const project = await prisma.project.findFirst({
    where: { id: proposal.projectId, companyId: proposal.companyId, serviceId: scope.userServiceId ?? "__none__" },
    select: { id: true },
  });
  if (!project) throw new HttpError(404, "Proposal not found");
}

// Shared logic for section edits: a section belongs to a proposal and is client-facing
// content, so editing/deleting one on a SENT/VIEWED proposal reverts it to DRAFT, bumps the
// version, and records history — mirroring the rule in proposalService.update().
async function revertParentToDraftById(
  parent: { id: string; status: ProposalStatus; version: number },
  companyId: string,
  change: "edited" | "deleted",
  userId?: string
) {
  if (parent.status !== "SENT" && parent.status !== "VIEWED") return;
  const updated = await proposalRepository.update(parent.id, companyId, {
    status: "DRAFT",
    version: parent.version + 1,
  });
  await proposalRepository.addHistory(parent.id, {
    action: "REVERTED_TO_DRAFT",
    comment: `Section ${change} while ${parent.status}; reverted to DRAFT (v${parent.version} → v${updated.version}). Must be re-sent.`,
    userId,
  });
}

async function revertParentToDraftIfLive(
  sectionId: string,
  companyId: string,
  change: "edited" | "deleted",
  userId?: string
) {
  const parent = await proposalRepository.findProposalBySectionId(sectionId, companyId);
  if (parent) await revertParentToDraftById(parent, companyId, change, userId);
}

// Emails every company admin that a proposal was accepted. Shared by accept() and
// acceptWithCascade() so the notification content/recipients stay in one place.
async function notifyAdminsAccepted(
  proposal: { id: string; title: string; amount: unknown; currency: string | null; clientId: string },
  companyId: string
) {
  const [admins, client] = await Promise.all([
    userRepository.findAdminsByCompanyId(companyId),
    clientRepository.findById(proposal.clientId, companyId),
  ]);
  const dashboardUrl = `${env.FRONTEND_URL}/app/proposals/${proposal.id}`;
  const currency = proposal.currency ?? "TND";

  void enqueueEmails(
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
  );
}

export const proposalService = {
  async getAllByClientId(
    clientId: string,
    options: { page: number; pageSize: number; status?: ProposalStatus }
  ) {
    return proposalRepository.findAllByClientId(clientId, options);
  },

  async getByIdForClient(id: string, clientId: string) {
    return proposalRepository.findByIdForClient(id, clientId);
  },

  async getAll(
    options: ListQueryOptions & {
      companyId: string;
      clientId?: string;
      status?: ProposalStatus;
      search?: string;
    },
    scope?: ServiceScope
  ) {
    // A MANAGER only sees proposals whose project is in their service. ADMIN sees all.
    const serviceId =
      scope?.userRole === "MANAGER" ? (scope.userServiceId ?? "__none__") : undefined;
    return proposalRepository.findAll({ ...options, serviceId });
  },

  async getById(id: string, companyId: string, scope?: ServiceScope) {
    const proposal = await proposalRepository.findById(id, companyId);
    assertProposalInScope(proposal, scope);
    return proposal;
  },

  async create(
    data: {
      title: string;
      description?: string;
      amount?: number;
      currency?: string;
      expiresAt?: Date;
      pdfUrl?: string;
      clientId: string;
      clientName?: string;
      email?: string;
      leadId?: string;
      projectId?: string;
      serviceRequestId?: string;
    },
    companyId: string
  ) {
    await tenantValidation.assertClientInCompany(data.clientId, companyId);

    if (!data.leadId) {
      // No source lead: create the proposal as-is (contact snapshot is whatever was passed).
      return proposalRepository.create({ ...data, companyId });
    }

    // Created from a lead: the lead must belong to the same company, the proposal is linked to
    // it, the lead's contact details snapshot the proposal (so it carries them independently of
    // the Client record), and the lead advances to PROPOSAL — all atomically so a failed status
    // update never leaves an orphaned proposal.
    const leadId = data.leadId;
    return prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({
        where: { id: leadId, companyId },
        select: { id: true, name: true, email: true },
      });
      if (!lead) throw new HttpError(404, "Lead not found");

      const proposal = await tx.proposal.create({
        data: {
          ...data,
          leadId,
          clientName: data.clientName ?? lead.name,
          email: data.email ?? lead.email,
          companyId,
        },
      });

      await tx.lead.update({
        where: { id: leadId },
        data: { status: "PROPOSAL" },
      });

      return proposal;
    });
  },

  async update(
    id: string,
    companyId: string,
    data: Partial<{
      title: string;
      description: string;
      status: ProposalStatus;
      amount: number;
      currency: string;
      expiresAt: Date;
      pdfUrl: string;
    }>,
    userId?: string,
    scope?: ServiceScope
  ) {
    const proposal = await proposalRepository.findById(id, companyId);
    await assertProposalInScope(proposal, scope);
    if (!proposal) throw new HttpError(404, "Proposal not found");

    // A proposal that's already in front of the client (SENT/VIEWED) must not be silently
    // edited. If any *client-facing content* field actually changes, revert it to DRAFT,
    // bump the version (invalidates in-flight acceptances), and record the change in history.
    // Non-content fields (pdfUrl regeneration, currency, expiresAt, internal metadata) do NOT
    // trigger a revert — they don't change what the client reviewed.
    const isLive = proposal.status === "SENT" || proposal.status === "VIEWED";
    const contentChanged =
      (data.title !== undefined && data.title !== proposal.title) ||
      (data.description !== undefined && data.description !== proposal.description) ||
      (data.amount !== undefined &&
        Number(data.amount) !== (proposal.amount != null ? Number(proposal.amount) : null));

    if (isLive && contentChanged && data.status === undefined) {
      const updated = await proposalRepository.update(id, companyId, {
        ...data,
        status: "DRAFT",
        version: proposal.version + 1,
      });
      await proposalRepository.addHistory(id, {
        action: "REVERTED_TO_DRAFT",
        comment: `Content edited while ${proposal.status}; reverted to DRAFT (v${proposal.version} → v${updated.version}). Must be re-sent.`,
        userId,
      });
      return updated;
    }

    return proposalRepository.update(id, companyId, data);
  },

  async delete(id: string, companyId: string) {
    return proposalRepository.delete(id, companyId);
  },

  async send(id: string, companyId: string, scope?: ServiceScope) {
    const proposal = await proposalRepository.findById(id, companyId);
    await assertProposalInScope(proposal, scope);
    const updated = await proposalRepository.update(id, companyId, { status: "SENT" });

    if (proposal) {
      const clientUsers = await userRepository.findByClientId(proposal.clientId);
      const viewUrl = `${env.FRONTEND_URL}/client/proposals/${id}`;
      const currency = proposal.currency ?? "TND";

      void enqueueEmails(
        clientUsers.map((user) => {
          const { subject, html } = proposalSentTemplate(
            user.name ?? "Client",
            proposal.title,
            proposal.amount != null ? Number(proposal.amount) : null,
            currency,
            viewUrl
          );
          return { to: user.email, subject, html };
        })
      );
    }

    return updated;
  },

  async accept(id: string, companyId: string, expectedVersion?: number) {
    const proposal = await proposalRepository.findById(id, companyId);
    if (!proposal) throw new HttpError(404, "Proposal not found");
    // Optimistic concurrency: the client accepts the version they actually reviewed. If the
    // proposal was edited (and version-bumped) since it was loaded, the acceptance refers to
    // stale content — reject it so the client re-reads the current version.
    if (expectedVersion !== undefined && expectedVersion !== proposal.version) {
      throw new HttpError(
        409,
        "This proposal was updated since you opened it. Please review the latest version.",
        "PROPOSAL_VERSION_MISMATCH",
        { currentVersion: proposal.version }
      );
    }
    // Only a live, client-facing proposal can be accepted. This blocks accepting a DRAFT
    // (never sent), re-accepting an ACCEPTED one, or reviving a REJECTED/EXPIRED proposal.
    if (!["SENT", "VIEWED"].includes(proposal.status)) {
      throw new HttpError(
        409,
        `Cannot accept a ${proposal.status} proposal`,
        "INVALID_PROPOSAL_TRANSITION"
      );
    }
    if (proposal.expiresAt && proposal.expiresAt < new Date()) {
      throw new HttpError(409, "This proposal has expired", "PROPOSAL_EXPIRED");
    }
    const updated = await proposalRepository.update(id, companyId, {
      status: "ACCEPTED",
      acceptedAt: new Date(),
    });

    await notifyAdminsAccepted(
      { id, title: proposal.title, amount: proposal.amount, currency: proposal.currency, clientId: proposal.clientId },
      companyId
    );

    return updated;
  },

  // Admin/manager acceptance with the full downstream cascade: lead → WON, a pre-filled Project,
  // a 30% deposit invoice, and a client-portal invitation. The data-layer writes (proposal,
  // lead, project, invoice) run in ONE transaction so a failure rolls everything back; the
  // side-effects (admin email, cache, client invite) run after commit and never undo the accept.
  //
  // Idempotency: a re-accept of an already-ACCEPTED proposal does not throw here — it runs in
  // "reconcile" mode, backfilling a missing project/invoice from a prior partial cascade. The
  // Project.proposalId / Invoice.proposalId @unique constraints are the hard backstops.
  async acceptWithCascade(id: string, companyId: string, expectedVersion?: number, uploadedById?: string) {
    const result = await prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.findUnique({
        where: { id, companyId },
        include: {
          linkedProject: { select: { id: true, serviceId: true } },
          invoice: { select: { id: true } },
          project: { select: { serviceId: true } },
        },
      });
      if (!proposal) throw new HttpError(404, "Proposal not found");

      const alreadyAccepted = proposal.status === "ACCEPTED";
      if (!alreadyAccepted) {
        // Same guards as accept(), enforced against the row read inside the tx (closes the
        // check-then-act race). Skipped entirely when reconciling an already-accepted proposal.
        if (expectedVersion !== undefined && expectedVersion !== proposal.version) {
          throw new HttpError(
            409,
            "This proposal was updated since you opened it. Please review the latest version.",
            "PROPOSAL_VERSION_MISMATCH",
            { currentVersion: proposal.version }
          );
        }
        if (!["SENT", "VIEWED"].includes(proposal.status)) {
          throw new HttpError(
            409,
            `Cannot accept a ${proposal.status} proposal`,
            "INVALID_PROPOSAL_TRANSITION"
          );
        }
        if (proposal.expiresAt && proposal.expiresAt < new Date()) {
          throw new HttpError(409, "This proposal has expired", "PROPOSAL_EXPIRED");
        }
        await tx.proposal.update({
          where: { id, companyId },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        });
      }

      // Lead → WON (no-op without a lead, already-WON, or out-of-company id).
      if (proposal.leadId) {
        await tx.lead.updateMany({
          where: { id: proposal.leadId, companyId, status: { not: "WON" } },
          data: { status: "WON" },
        });
      }

      // Project — create only if none is linked yet. serviceId is inherited from the proposal's
      // source project when there is one; otherwise the project carries no service.
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
              companyId,
              proposalId: proposal.id,
              budget: proposal.amount != null ? String(proposal.amount) : undefined,
              deadline: proposal.expiresAt ?? undefined,
            },
            select: { id: true },
          });
          projectId = project.id;
        } catch (err) {
          // A concurrent cascade created the project first (proposalId @unique). Reuse it.
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            const existing = await tx.project.findFirst({
              where: { proposalId: proposal.id, companyId },
              select: { id: true },
            });
            projectId = existing?.id ?? null;
          } else {
            throw err;
          }
        }
      }

      // Deposit invoice — 30% of the proposal amount, only if there's an amount and no invoice.
      let invoiceId = proposal.invoice?.id ?? null;
      if (!invoiceId && proposal.amount != null) {
        const depositAmount = Math.round(Number(proposal.amount) * 0.3 * 100) / 100;
        try {
          const invoice = await invoiceService.createDepositInvoiceTx(tx, {
            companyId,
            title: `Acompte 30% — ${proposal.title}`,
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
          // Invoice.proposalId @unique → a deposit already exists; reuse it.
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            const existing = await tx.invoice.findFirst({
              where: { proposalId: proposal.id, companyId },
              select: { id: true },
            });
            invoiceId = existing?.id ?? null;
          } else {
            throw err;
          }
        }
      }

      return {
        proposalId: id,
        clientId: proposal.clientId,
        title: proposal.title,
        amount: proposal.amount,
        currency: proposal.currency,
        clientName: proposal.clientName,
        email: proposal.email,
        projectId,
        invoiceId,
      };
    });

    // --- Post-commit side effects (never roll back the acceptance) ---
    await notifyAdminsAccepted(
      { id: result.proposalId, title: result.title, amount: result.amount, currency: result.currency, clientId: result.clientId },
      companyId
    );

    await invalidateTags([
      cacheTags.company(companyId),
      cacheTags.dashboard(companyId),
      cacheTags.client(companyId, result.clientId),
    ]);

    // Invite the client portal user. Best-effort: a missing email or an existing portal account
    // (inviteClientUser throws 409) must not fail an otherwise-successful acceptance.
    let clientInvited = false;
    const client = await clientRepository.findById(result.clientId, companyId);
    const inviteEmail = result.email ?? client?.email ?? undefined;
    const inviteName = result.clientName ?? client?.name ?? undefined;
    if (inviteEmail && inviteName) {
      try {
        await clientService.inviteClientUser(result.clientId, companyId, inviteEmail, inviteName);
        clientInvited = true;
      } catch (err) {
        if (!(err instanceof HttpError && err.statusCode === 409)) throw err;
      }
    }

    const proposal = await proposalRepository.findById(id, companyId);

    // Generate the 7 onboarding PDFs. Best-effort: failures are logged but never undo the
    // acceptance. We only generate when we have a project (no project = no folder to store into).
    if (result.projectId && uploadedById) {
      const docProject = {
        id: result.projectId,
        name: result.title,
        description: proposal?.description ?? undefined,
        budget: proposal?.amount != null ? String(proposal.amount) : undefined,
        deadline: proposal?.expiresAt ?? undefined,
        serviceId: null as string | null,
      };
      const docClient = client ?? { id: result.clientId, name: result.clientName ?? "Client", email: result.email ?? undefined };
      const manager = await userRepository.findById(uploadedById).catch(() => null);
      const docManager = manager
        ? { id: manager.id, name: manager.name ?? undefined, email: manager.email }
        : { id: uploadedById, name: undefined, email: "" };
      const docProposal = {
        id,
        title: result.title,
        description: proposal?.description ?? undefined,
        amount: result.amount != null ? Number(result.amount) : null,
        currency: result.currency,
        expiresAt: proposal?.expiresAt ?? undefined,
      };

      void Promise.allSettled([
        documentGeneratorService.generateWelcomeLetter(docProposal, docProject, docClient, docManager, companyId, uploadedById),
        documentGeneratorService.generateContract(docProposal, docProject, docClient, companyId, uploadedById),
        documentGeneratorService.generateSpecs(docProject, docClient, companyId, uploadedById),
        documentGeneratorService.generateClientBrief(docProject, docClient, companyId, uploadedById),
        documentGeneratorService.generateQuotePDF(docProposal, docProject, docClient, companyId, uploadedById),
        ...(result.invoiceId
          ? [
              (async () => {
                const { prismaRead } = await import("../config/prisma.js");
                const inv = await prismaRead.invoice.findUnique({ where: { id: result.invoiceId! }, select: { id: true, number: true, amount: true, currency: true, dueDate: true } });
                if (!inv) return;
                return documentGeneratorService.generateInvoicePDF(
                  { ...inv, amount: inv.amount != null ? Number(inv.amount) : null },
                  docProject, docClient, companyId, uploadedById
                );
              })(),
            ]
          : []),
        documentGeneratorService.generateRoadmap(docProject, companyId, uploadedById),
      ]).then((results) => {
        results.forEach((r, i) => {
          if (r.status === "rejected") console.error(`[documentGenerator] PDF #${i} failed:`, r.reason);
        });
      });
    }

    return {
      proposal,
      projectId: result.projectId,
      invoiceId: result.invoiceId,
      clientInvited,
    };
  },

  async reject(id: string, companyId: string, comment?: string) {
    const proposal = await proposalRepository.findById(id, companyId);
    if (!proposal) throw new HttpError(404, "Proposal not found");
    // Same source states as accept: only a sent/viewed proposal can be rejected.
    if (!["SENT", "VIEWED"].includes(proposal.status)) {
      throw new HttpError(
        409,
        `Cannot reject a ${proposal.status} proposal`,
        "INVALID_PROPOSAL_TRANSITION"
      );
    }
    const updated = await proposalRepository.update(id, companyId, {
      status: "REJECTED",
      rejectedAt: new Date(),
    });

    if (proposal) {
      const [admins, client] = await Promise.all([
        userRepository.findAdminsByCompanyId(companyId),
        clientRepository.findById(proposal.clientId, companyId),
      ]);

      void enqueueEmails(
        admins.map((admin) => {
          const { subject, html } = proposalRejectedTemplate(
            admin.name ?? "Admin",
            proposal.title,
            client?.name ?? "Le client",
            comment
          );
          return { to: admin.email, subject, html };
        })
      );
    }

    return updated;
  },

  async addSection(
    proposalId: string,
    companyId: string,
    data: { title: string; content?: string; orderIndex: number },
    scope?: ServiceScope
  ) {
    const proposal = await proposalRepository.findById(proposalId, companyId);
    await assertProposalInScope(proposal, scope);
    return proposalRepository.addSection(proposalId, companyId, data);
  },

  async updateSection(
    id: string,
    companyId: string,
    data: { title?: string; content?: string; orderIndex?: number },
    userId?: string,
    scope?: ServiceScope
  ) {
    const parent = await proposalRepository.findProposalBySectionId(id, companyId);
    await assertProposalInScope(parent, scope);
    const result = await proposalRepository.updateSection(id, companyId, data);
    await revertParentToDraftIfLive(id, companyId, "edited", userId);
    return result;
  },

  async deleteSection(id: string, companyId: string, userId?: string, scope?: ServiceScope) {
    // Capture the parent before deletion (the section row is gone afterwards), then revert.
    const parent = await proposalRepository.findProposalBySectionId(id, companyId);
    await assertProposalInScope(parent, scope);
    const result = await proposalRepository.deleteSection(id, companyId);
    if (parent) await revertParentToDraftById(parent, companyId, "deleted", userId);
    return result;
  },

  async addHistory(
    proposalId: string,
    data: { action: string; comment?: string; userId?: string }
  ) {
    return proposalRepository.addHistory(proposalId, data);
  },
};
