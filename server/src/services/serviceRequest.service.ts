import { serviceRequestRepository } from "../repositories/serviceRequest.repository.js";
import { notificationRepository } from "../repositories/notification.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { HttpError } from "../utils/httpError.js";
import type { ListQueryOptions } from "../utils/listQuery.js";

export const serviceRequestService = {
  async getServiceRequestsByClient(clientId: string, options: ListQueryOptions) {
    return serviceRequestRepository.findAllByClientId(clientId, options);
  },

  async getServiceRequestsByCompany(companyId: string, options: ListQueryOptions) {
    return serviceRequestRepository.findAllByCompanyId(companyId, options);
  },

  async getServiceRequestById(id: string) {
    const req = await serviceRequestRepository.findById(id);
    if (!req) throw new HttpError(404, "Service request not found");
    return req;
  },

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

    return request;
  },

  async updateServiceRequest(
    id: string,
    data: Partial<{ title?: string; description?: string; status?: "NEW" | "IN_PROGRESS" | "DONE" }>,
    companyId?: string
  ) {
    if (!companyId) {
      throw new HttpError(403, "Company access required");
    }
    const req = await serviceRequestRepository.findById(id, companyId);
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
    }

    return updated;
  },

  async deleteServiceRequest(id: string, companyId: string) {
    const req = await serviceRequestRepository.findById(id, companyId);
    if (!req) throw new HttpError(404, "Service request not found");
    return serviceRequestRepository.delete(id, companyId);
  },
};
