import { serviceRequestRepository } from "../repositories/serviceRequest.repository.js";
import { notificationRepository } from "../repositories/notification.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueEmail } from "../jobs/queues.js";
import { serviceRequestReceivedTemplate, serviceRequestStatusTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";
import type { ListQueryOptions } from "../utils/listQuery.js";
import type { ServiceRequestStatus, Priority } from "@prisma/client";

const ALLOWED_TRANSITIONS: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  NEW: ["IN_REVIEW", "CANCELLED"],
  IN_REVIEW: ["IN_PROGRESS", "WAITING_CLIENT", "CANCELLED"],
  IN_PROGRESS: ["WAITING_CLIENT", "COMPLETED", "CANCELLED"],
  WAITING_CLIENT: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

function assertValidTransition(from: ServiceRequestStatus, to: ServiceRequestStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) throw new HttpError(422, `Cannot transition from ${from} to ${to}. Allowed: ${allowed.join(", ") || "none"}`);
}

export const serviceRequestService = {
  async getServiceRequestsByClient(clientId: string, options: ListQueryOptions) {
    return serviceRequestRepository.findAllByClientId(clientId, options);
  },

  async getServiceRequestsByCompany(options: ListQueryOptions & { status?: ServiceRequestStatus; clientId?: string; assignedToId?: string; priority?: Priority; type?: "SUPPORT" | "NEW_PROJECT" }) {
    return serviceRequestRepository.findAll(options);
  },

  async getServiceRequestById(id: string) {
    const req = await serviceRequestRepository.findById(id);
    if (!req) throw new HttpError(404, "Service request not found");
    return req;
  },

  async createServiceRequest(data: { title: string; description?: string; type?: "SUPPORT" | "NEW_PROJECT"; clientId: string }) {
    const request = await serviceRequestRepository.create({ ...data, type: data.type ?? "NEW_PROJECT" });

    const admins = await userRepository.findAdmins();
    await notificationRepository.createMany(admins.map((admin) => ({ userId: admin.id, title: "Nouvelle demande de service", message: `Une nouvelle demande de service "${data.title}" a été soumise.` })));

    const dashboardUrl = `${env.FRONTEND_URL}/app/service-requests`;
    for (const admin of admins) {
      const { subject, html } = serviceRequestReceivedTemplate(admin.name ?? "Admin", "un client", data.title, dashboardUrl);
      void enqueueEmail({ to: admin.email, subject, html });
    }

    return request;
  },

  // type is intentionally excluded from updates — reclassifying a request requires creating a new one
  async adminUpdateServiceRequest(id: string, userId: string, data: { title?: string; description?: string; status?: ServiceRequestStatus; priority?: Priority; assignedToId?: string | null }) {
    if ("type" in data) throw new HttpError(422, "The type of a service request cannot be changed; create a new request instead", "SERVICE_REQUEST_TYPE_IMMUTABLE");
    const current = await serviceRequestRepository.findByIdSimple(id);
    if (!current) throw new HttpError(404, "Service request not found");

    if (data.status && data.status !== current.status) assertValidTransition(current.status, data.status);

    const updated = await serviceRequestRepository.update(id, data);

    const historyPromises: Promise<unknown>[] = [];
    if (data.status && data.status !== current.status) {
      historyPromises.push(serviceRequestRepository.addHistory({ serviceRequestId: id, userId, field: "status", oldValue: current.status, newValue: data.status }));
    }
    if (data.priority && data.priority !== current.priority) {
      historyPromises.push(serviceRequestRepository.addHistory({ serviceRequestId: id, userId, field: "priority", oldValue: current.priority, newValue: data.priority }));
    }
    if ("assignedToId" in data && data.assignedToId !== current.assignedToId) {
      historyPromises.push(serviceRequestRepository.addHistory({ serviceRequestId: id, userId, field: "assignedToId", oldValue: current.assignedToId ?? null, newValue: data.assignedToId ?? null }));
    }
    await Promise.all(historyPromises);

    if (data.status && data.status !== current.status) {
      const clientUsers = await userRepository.findByClientId(current.clientId);
      await notificationRepository.createMany(clientUsers.map((user) => ({ userId: user.id, title: "Mise à jour de votre demande", message: `La demande "${current.title}" est maintenant : ${data.status}` })));
      for (const user of clientUsers) {
        const { subject, html } = serviceRequestStatusTemplate(user.name ?? "Client", current.title, data.status);
        void enqueueEmail({ to: user.email, subject, html });
      }
    }

    return updated;
  },

  async deleteServiceRequest(id: string) {
    const req = await serviceRequestRepository.findByIdSimple(id);
    if (!req) throw new HttpError(404, "Service request not found");
    const linked = await serviceRequestRepository.findLinkedProposal(id);
    if (linked) {
      throw new HttpError(409, "Cannot delete a service request that has a linked proposal");
    }
    return serviceRequestRepository.delete(id);
  },

  async addComment(serviceRequestId: string, authorId: string, body: string, isInternal: boolean) {
    const req = await serviceRequestRepository.findByIdSimple(serviceRequestId);
    if (!req) throw new HttpError(404, "Service request not found");

    const comment = await serviceRequestRepository.addComment({ serviceRequestId, authorId, body, isInternal });

    if (!isInternal) {
      const clientUsers = await userRepository.findByClientId(req.clientId);
      await notificationRepository.createMany(clientUsers.map((user) => ({ userId: user.id, title: "Nouveau message sur votre demande", message: `Un message a été ajouté à la demande "${req.title}"` })));
    }

    return comment;
  },

  async deleteComment(commentId: string, authorId: string) {
    return serviceRequestRepository.deleteComment(commentId, authorId);
  },
};
