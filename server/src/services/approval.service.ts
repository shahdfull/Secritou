import { approvalRepository } from "../repositories/approval.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueEmail, enqueueEmails, enqueueNotifications } from "../jobs/queues.js";
import { approvalRequestedTemplate, approvalDecisionTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import type { ApprovalStatus } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";

export const approvalService = {
  async getAllByClientId(clientId: string, options: { page: number; pageSize: number; status?: ApprovalStatus }) {
    return approvalRepository.findAllByClientId(clientId, options);
  },

  async getByIdForClient(id: string, clientId: string) {
    return approvalRepository.findByIdForClient(id, clientId);
  },

  async getAll(options: ListQueryOptions & { clientId?: string; status?: ApprovalStatus; search?: string; serviceId?: string | null }) {
    return approvalRepository.findAll(options);
  },

  async getById(id: string) {
    return approvalRepository.findById(id);
  },

  async create(data: { title: string; description?: string; dueDate?: Date; clientId: string; projectId?: string }, requesterId?: string) {
    const approval = await approvalRepository.create(data);

    const [clientUsers, requester] = await Promise.all([
      userRepository.findByClientId(data.clientId),
      requesterId ? userRepository.findById(requesterId) : Promise.resolve(null),
    ]);

    const approvalUrl = `${env.FRONTEND_URL}/client/approvals/${approval.id}`;
    const dueDate = data.dueDate ? new Date(data.dueDate).toLocaleDateString("fr-FR") : ":";

    void Promise.all([
      enqueueEmails(
        clientUsers.map((user) => {
          const { subject, html } = approvalRequestedTemplate(user.name ?? "Client", approval.title, requester?.name ?? "L'équipe Secritou", dueDate, approvalUrl);
          return { to: user.email, subject, html };
        })
      ),
      enqueueNotifications(
        clientUsers.map((user) => ({
          userId: user.id,
          title: "Validation requise",
          message: `Une validation vous a été envoyée : "${approval.title}".`,
          type: "APPROVAL_REQUESTED" as const,
          entityId: approval.id,
          link: approvalUrl,
        }))
      ),
    ]);

    return approval;
  },

  async update(id: string, data: Partial<{ title: string; description: string; status: ApprovalStatus; dueDate: Date }>) {
    return approvalRepository.update(id, data);
  },

  async delete(id: string) {
    return approvalRepository.delete(id);
  },

  async approve(id: string, comment?: string, userId?: string) {
    const approval = await approvalRepository.findById(id);
    const updated = await approvalRepository.update(id, { status: "APPROVED" });
    await approvalRepository.addTimeline(id, { action: "APPROVED", comment, status: "APPROVED", userId });

    if (approval) {
      const [decider, clientUsers, admins] = await Promise.all([
        userId ? userRepository.findById(userId) : Promise.resolve(null),
        userRepository.findByClientId(approval.clientId),
        userRepository.findAdmins(),
      ]);
      const approvalUrl = `${env.FRONTEND_URL}/app/approvals/${approval.id}`;
      void Promise.all([
        enqueueEmails(clientUsers.map((user) => {
          const { subject, html } = approvalDecisionTemplate(user.name ?? "Client", approval.title, "APPROVED", decider?.name ?? "L'équipe Secritou", comment);
          return { to: user.email, subject, html };
        })),
        enqueueNotifications(clientUsers.map((user) => ({
          userId: user.id,
          title: "Validation acceptée",
          message: `Votre validation "${approval.title}" a été acceptée.`,
          type: "APPROVAL_ACCEPTED" as const,
          entityId: approval.id,
          link: `${env.FRONTEND_URL}/client/approvals/${approval.id}`,
        }))),
        enqueueNotifications(admins.map((admin) => ({
          userId: admin.id,
          title: "Validation acceptée par le client",
          message: `Le client a accepté la validation "${approval.title}".`,
          type: "APPROVAL_ACCEPTED" as const,
          entityId: approval.id,
          link: approvalUrl,
        }))),
      ]);
    }

    return updated;
  },

  async reject(id: string, comment?: string, userId?: string) {
    const approval = await approvalRepository.findById(id);
    const updated = await approvalRepository.update(id, { status: "REJECTED" });
    await approvalRepository.addTimeline(id, { action: "REJECTED", comment, status: "REJECTED", userId });

    if (approval) {
      const [decider, clientUsers, admins] = await Promise.all([
        userId ? userRepository.findById(userId) : Promise.resolve(null),
        userRepository.findByClientId(approval.clientId),
        userRepository.findAdmins(),
      ]);
      const approvalUrl = `${env.FRONTEND_URL}/app/approvals/${approval.id}`;
      void Promise.all([
        enqueueEmails(clientUsers.map((user) => {
          const { subject, html } = approvalDecisionTemplate(user.name ?? "Client", approval.title, "REJECTED", decider?.name ?? "L'équipe Secritou", comment);
          return { to: user.email, subject, html };
        })),
        enqueueNotifications(clientUsers.map((user) => ({
          userId: user.id,
          title: "Validation refusée",
          message: `Votre validation "${approval.title}" a été refusée.`,
          type: "APPROVAL_REJECTED" as const,
          entityId: approval.id,
          link: `${env.FRONTEND_URL}/client/approvals/${approval.id}`,
        }))),
        enqueueNotifications(admins.map((admin) => ({
          userId: admin.id,
          title: "Validation refusée par le client",
          message: `Le client a refusé la validation "${approval.title}".`,
          type: "APPROVAL_REJECTED" as const,
          entityId: approval.id,
          link: approvalUrl,
        }))),
      ]);
    }

    return updated;
  },

  async comment(id: string, comment: string, userId?: string) {
    const updated = await approvalRepository.update(id, { status: "COMMENTED" });
    await approvalRepository.addTimeline(id, { action: "COMMENTED", comment, status: "COMMENTED", userId });
    return updated;
  },

  async addAttachment(approvalId: string, data: { name: string; url: string }) {
    return approvalRepository.addAttachment(approvalId, data);
  },

  async deleteAttachment(id: string) {
    return approvalRepository.deleteAttachment(id);
  },
};
