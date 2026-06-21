import { approvalRepository } from "../repositories/approval.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { clientRepository } from "../repositories/client.repository.js";
import { enqueueEmail, enqueueEmails } from "../jobs/queues.js";
import { approvalRequestedTemplate, approvalDecisionTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import type { ApprovalStatus } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { tenantValidation } from "./tenantValidation.service.js";

export const approvalService = {
  async getAllByClientId(
    clientId: string,
    options: { page: number; pageSize: number; status?: ApprovalStatus }
  ) {
    return approvalRepository.findAllByClientId(clientId, options);
  },

  async getByIdForClient(id: string, clientId: string) {
    return approvalRepository.findByIdForClient(id, clientId);
  },

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
    companyId: string,
    requesterId?: string
  ) {
    await tenantValidation.assertClientInCompany(data.clientId, companyId);
    const approval = await approvalRepository.create({ ...data, companyId });

    const [clientUsers, requester] = await Promise.all([
      userRepository.findByClientId(data.clientId),
      requesterId ? userRepository.findById(requesterId) : Promise.resolve(null),
    ]);

    const approvalUrl = `${env.FRONTEND_URL}/client/approvals/${approval.id}`;
    const dueDate = data.dueDate
      ? new Date(data.dueDate).toLocaleDateString("fr-FR")
      : "—";

    void enqueueEmails(
      clientUsers.map((user) => {
        const { subject, html } = approvalRequestedTemplate(
          user.name ?? "Client",
          approval.title,
          requester?.name ?? "L'équipe Secritou",
          dueDate,
          approvalUrl
        );
        return { to: user.email, subject, html };
      })
    );

    return approval;
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
