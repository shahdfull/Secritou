import { approvalRepository } from "../repositories/approval.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueEmail } from "../jobs/queues.js";
import { approvalDecisionTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import type { ApprovalStatus } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { tenantValidation } from "./tenantValidation.service.js";

export const approvalService = {
  async getAll(
    options: ListQueryOptions & {
      companyId: string;
      clientId?: string;
      status?: ApprovalStatus;
      search?: string;
    }
  ) {
    return approvalRepository.findAll(options);
  },

  async getById(id: string, companyId: string) {
    return approvalRepository.findById(id, companyId);
  },

  async create(
    data: {
      title: string;
      description?: string;
      dueDate?: Date;
      clientId: string;
      projectId?: string;
    },
    companyId: string
  ) {
    await tenantValidation.assertClientInCompany(data.clientId, companyId);
    return approvalRepository.create({ ...data, companyId });
  },

  async update(
    id: string,
    companyId: string,
    data: Partial<{
      title: string;
      description: string;
      status: ApprovalStatus;
      dueDate: Date;
    }>
  ) {
    return approvalRepository.update(id, companyId, data);
  },

  async delete(id: string, companyId: string) {
    return approvalRepository.delete(id, companyId);
  },

  async approve(id: string, companyId: string, comment?: string, userId?: string) {
    const approval = await approvalRepository.findById(id, companyId);
    const updated = await approvalRepository.update(id, companyId, { status: "APPROVED" });
    await approvalRepository.addTimeline(id, {
      action: "APPROVED",
      comment,
      status: "APPROVED",
      userId,
    });

    if (approval) {
      const decider = userId ? await userRepository.findById(userId) : null;
      const clientUsers = await userRepository.findByClientId(approval.clientId);
      for (const user of clientUsers) {
        const { subject, html } = approvalDecisionTemplate(
          user.name ?? "Client",
          approval.title,
          "APPROVED",
          decider?.name ?? "L'équipe Secritou",
          comment
        );
        void enqueueEmail({ to: user.email, subject, html });
      }
    }

    return updated;
  },

  async reject(id: string, companyId: string, comment?: string, userId?: string) {
    const approval = await approvalRepository.findById(id, companyId);
    const updated = await approvalRepository.update(id, companyId, { status: "REJECTED" });
    await approvalRepository.addTimeline(id, {
      action: "REJECTED",
      comment,
      status: "REJECTED",
      userId,
    });

    if (approval) {
      const decider = userId ? await userRepository.findById(userId) : null;
      const clientUsers = await userRepository.findByClientId(approval.clientId);
      for (const user of clientUsers) {
        const { subject, html } = approvalDecisionTemplate(
          user.name ?? "Client",
          approval.title,
          "REJECTED",
          decider?.name ?? "L'équipe Secritou",
          comment
        );
        void enqueueEmail({ to: user.email, subject, html });
      }
    }

    return updated;
  },

  async comment(id: string, companyId: string, comment: string, userId?: string) {
    const updated = await approvalRepository.update(id, companyId, { status: "COMMENTED" });
    await approvalRepository.addTimeline(id, {
      action: "COMMENTED",
      comment,
      status: "COMMENTED",
      userId,
    });
    return updated;
  },

  async addAttachment(approvalId: string, companyId: string, data: { name: string; url: string }) {
    return approvalRepository.addAttachment(approvalId, companyId, data);
  },

  async deleteAttachment(id: string, companyId: string) {
    return approvalRepository.deleteAttachment(id, companyId);
  },
};
