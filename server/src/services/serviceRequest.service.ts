import { serviceRequestRepository } from "../repositories/serviceRequest.repository.js";
import { notificationRepository } from "../repositories/notification.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueEmail } from "../jobs/queues.js";
import {
  serviceRequestReceivedTemplate,
  serviceRequestStatusTemplate,
} from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";
import type { ListQueryOptions } from "../utils/listQuery.js";
import type { ServiceRequestStatus } from "@prisma/client";

// ─── Status machine ───────────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  NEW: ["IN_REVIEW", "CANCELLED"],
  IN_REVIEW: ["IN_PROGRESS", "WAITING_CLIENT", "CANCELLED"],
  IN_PROGRESS: ["WAITING_CLIENT", "COMPLETED", "CANCELLED"],
  WAITING_CLIENT: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  DONE: ["COMPLETED"], // legacy migration path
};

function assertValidTransition(from: ServiceRequestStatus, to: ServiceRequestStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new HttpError(
      422,
      `Cannot transition from ${from} to ${to}. Allowed: ${allowed.join(", ") || "none"}`
    );
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const serviceRequestService = {
  // ── Client queries ────────────────────────────────────────────────────────────

  async getServiceRequestsByClient(clientId: string, options: ListQueryOptions) {
    return serviceRequestRepository.findAllByClientId(clientId, options);
  },

  // ── Admin queries ─────────────────────────────────────────────────────────────

  async getServiceRequestsByCompany(
    companyId: string,
    options: ListQueryOptions & {
      status?: ServiceRequestStatus;
      clientId?: string;
      assignedToId?: string;
      priority?: string;
    }
  ) {
    return serviceRequestRepository.findAllByCompanyId(companyId, options);
  },

  async getServiceRequestById(id: string, companyId?: string) {
    const req = await serviceRequestRepository.findById(id, companyId);
    if (!req) throw new HttpError(404, "Service request not found");
    return req;
  },

  // ── Client create ─────────────────────────────────────────────────────────────

  async createServiceRequest(data: {
    title: string;
    description?: string;
    clientId: string;
    companyId: string;
  }) {
    const request = await serviceRequestRepository.create(data);

    const admins = await userRepository.findAdminsByCompanyId(data.companyId);
    await notificationRepository.createMany(
      admins.map((admin) => ({
        userId: admin.id,
        title: "Nouvelle demande de service",
        message: `Une nouvelle demande de service "${data.title}" a été soumise.`,
      }))
    );

    const dashboardUrl = `${env.FRONTEND_URL}/app/service-requests`;
    for (const admin of admins) {
      const { subject, html } = serviceRequestReceivedTemplate(
        admin.name ?? "Admin",
        "un client",
        data.title,
        dashboardUrl
      );
      void enqueueEmail({ to: admin.email, subject, html });
    }

    return request;
  },

  // ── Admin update (status machine + history) ───────────────────────────────────

  async adminUpdateServiceRequest(
    id: string,
    companyId: string,
    userId: string,
    data: {
      title?: string;
      description?: string;
      status?: ServiceRequestStatus;
      priority?: string;
      assignedToId?: string | null;
    }
  ) {
    const current = await serviceRequestRepository.findByIdSimple(id, companyId);
    if (!current) throw new HttpError(404, "Service request not found");

    // Validate status transition
    if (data.status && data.status !== current.status) {
      assertValidTransition(current.status, data.status);
    }

    const updated = await serviceRequestRepository.update(id, companyId, data);

    // Record history entries
    const historyPromises: Promise<unknown>[] = [];

    if (data.status && data.status !== current.status) {
      historyPromises.push(
        serviceRequestRepository.addHistory({
          serviceRequestId: id,
          userId,
          field: "status",
          oldValue: current.status,
          newValue: data.status,
        })
      );
    }

    if (data.priority && data.priority !== current.priority) {
      historyPromises.push(
        serviceRequestRepository.addHistory({
          serviceRequestId: id,
          userId,
          field: "priority",
          oldValue: current.priority,
          newValue: data.priority,
        })
      );
    }

    if ("assignedToId" in data && data.assignedToId !== current.assignedToId) {
      historyPromises.push(
        serviceRequestRepository.addHistory({
          serviceRequestId: id,
          userId,
          field: "assignedToId",
          oldValue: current.assignedToId ?? null,
          newValue: data.assignedToId ?? null,
        })
      );
    }

    await Promise.all(historyPromises);

    // Notify client users on status change
    if (data.status && data.status !== current.status) {
      const clientUsers = await userRepository.findByClientId(current.clientId);

      await notificationRepository.createMany(
        clientUsers.map((user) => ({
          userId: user.id,
          title: "Mise à jour de votre demande",
          message: `La demande "${current.title}" est maintenant : ${data.status}`,
        }))
      );

      for (const user of clientUsers) {
        const { subject, html } = serviceRequestStatusTemplate(
          user.name ?? "Client",
          current.title,
          data.status
        );
        void enqueueEmail({ to: user.email, subject, html });
      }
    }

    return updated;
  },

  // ── Legacy client update (kept for backward compat) ──────────────────────────

  async updateServiceRequest(
    id: string,
    data: Partial<{ title?: string; description?: string; status?: ServiceRequestStatus }>,
    companyId?: string
  ) {
    if (!companyId) throw new HttpError(403, "Company access required");
    const req = await serviceRequestRepository.findByIdSimple(id, companyId);
    if (!req) throw new HttpError(404, "Service request not found");

    const updated = await serviceRequestRepository.update(id, companyId, data);

    if (data.status && data.status !== req.status) {
      const clientUsers = await userRepository.findByClientId(req.clientId);
      await notificationRepository.createMany(
        clientUsers.map((user) => ({
          userId: user.id,
          title: "Mise à jour de la demande de service",
          message: `La demande de service "${req.title}" est passée à ${data.status}`,
        }))
      );

      for (const user of clientUsers) {
        const { subject, html } = serviceRequestStatusTemplate(
          user.name ?? "Client",
          req.title,
          data.status
        );
        void enqueueEmail({ to: user.email, subject, html });
      }
    }

    return updated;
  },

  async deleteServiceRequest(id: string, companyId: string) {
    const req = await serviceRequestRepository.findByIdSimple(id, companyId);
    if (!req) throw new HttpError(404, "Service request not found");
    return serviceRequestRepository.delete(id, companyId);
  },

  // ── Comments ──────────────────────────────────────────────────────────────────

  async addComment(
    serviceRequestId: string,
    companyId: string,
    authorId: string,
    body: string,
    isInternal: boolean
  ) {
    const req = await serviceRequestRepository.findByIdSimple(serviceRequestId, companyId);
    if (!req) throw new HttpError(404, "Service request not found");

    const comment = await serviceRequestRepository.addComment({
      serviceRequestId,
      authorId,
      body,
      isInternal,
    });

    // Notify client if comment is not internal
    if (!isInternal) {
      const clientUsers = await userRepository.findByClientId(req.clientId);
      await notificationRepository.createMany(
        clientUsers.map((user) => ({
          userId: user.id,
          title: "Nouveau message sur votre demande",
          message: `Un message a été ajouté à la demande "${req.title}"`,
        }))
      );
    }

    return comment;
  },

  async deleteComment(commentId: string, authorId: string) {
    return serviceRequestRepository.deleteComment(commentId, authorId);
  },
};
