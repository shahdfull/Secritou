import { proposalRepository } from "../repositories/proposal.repository.js";
import type { ProposalStatus } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { tenantValidation } from "./tenantValidation.service.js";

export const proposalService = {
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
    },
    companyId: string
  ) {
    // Validate client is in company
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
    return proposalRepository.update(id, companyId, { status: "SENT" });
  },

  async accept(id: string, companyId: string) {
    return proposalRepository.update(id, companyId, { status: "ACCEPTED", acceptedAt: new Date() });
  },

  async reject(id: string, companyId: string, comment?: string) {
    return proposalRepository.update(id, companyId, { status: "REJECTED", rejectedAt: new Date() });
  },

  async view(id: string, companyId: string) {
    return proposalRepository.update(id, companyId, { status: "VIEWED", viewedAt: new Date() });
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
