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
    }
  ) {
    return proposalRepository.findAll(options);
  },

  async getById(id: string, companyId: string) {
    return proposalRepository.findById(id, companyId);
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
      projectId?: string;
      serviceRequestId?: string;
    },
    companyId: string
  ) {
    await tenantValidation.assertClientInCompany(data.clientId, companyId);
    return proposalRepository.create({ ...data, companyId });
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
    }>
  ) {
    return proposalRepository.update(id, companyId, data);
  },

  async delete(id: string, companyId: string) {
    return proposalRepository.delete(id, companyId);
  },

  async send(id: string, companyId: string) {
    const proposal = await proposalRepository.findById(id, companyId);
    const updated = await proposalRepository.update(id, companyId, { status: "SENT" });

    if (proposal) {
      const clientUsers = await userRepository.findByClientId(proposal.clientId);
      const viewUrl = `${env.FRONTEND_URL}/client/proposals/${id}`;
      const currency = proposal.currency ?? "EUR";

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

  async accept(id: string, companyId: string) {
    const proposal = await proposalRepository.findById(id, companyId);
    if (!proposal) throw new HttpError(404, "Proposal not found");
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
      const currency = proposal.currency ?? "EUR";

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
    data: { title: string; content?: string; orderIndex: number }
  ) {
    return proposalRepository.addSection(proposalId, companyId, data);
  },

  async updateSection(
    id: string,
    companyId: string,
    data: { title?: string; content?: string; orderIndex?: number }
  ) {
    return proposalRepository.updateSection(id, companyId, data);
  },

  async deleteSection(id: string, companyId: string) {
    return proposalRepository.deleteSection(id, companyId);
  },

  async addHistory(
    proposalId: string,
    data: { action: string; comment?: string; userId?: string }
  ) {
    return proposalRepository.addHistory(proposalId, data);
  },
};
