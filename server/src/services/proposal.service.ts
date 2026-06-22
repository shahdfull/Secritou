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
import type { ListQueryOptions } from "../utils/listQuery.js";
import { tenantValidation } from "./tenantValidation.service.js";
import { HttpError } from "../utils/httpError.js";
import type { ServiceScope } from "../utils/serviceScope.js";
import { prisma } from "../config/prisma.js";

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

    if (proposal) {
      const [admins, client] = await Promise.all([
        userRepository.findAdminsByCompanyId(companyId),
        clientRepository.findById(proposal.clientId, companyId),
      ]);
      const dashboardUrl = `${env.FRONTEND_URL}/app/proposals/${id}`;
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

    return updated;
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
