import { serviceRequestRepository } from "../repositories/serviceRequest.repository.js";
import { HttpError } from "../utils/httpError.js";

export const serviceRequestService = {
  async getServiceRequestsByClient(clientId: string) {
    return serviceRequestRepository.findAllByClientId(clientId);
  },

  async getServiceRequestsByCompany(companyId: string) {
    return serviceRequestRepository.findAllByCompanyId(companyId);
  },

  async getServiceRequestById(id: string) {
    const req = await serviceRequestRepository.findById(id);
    if (!req) throw new HttpError(404, "Service request not found");
    return req;
  },

  async createServiceRequest(data: { title: string; description?: string; clientId: string; companyId: string }) {
    return serviceRequestRepository.create(data);
  },

  async updateServiceRequest(id: string, data: Partial<{ title?: string; description?: string; status?: "NEW" | "IN_PROGRESS" | "DONE" }>) {
    const req = await serviceRequestRepository.findById(id);
    if (!req) throw new HttpError(404, "Service request not found");
    return serviceRequestRepository.update(id, data);
  },

  async deleteServiceRequest(id: string) {
    const req = await serviceRequestRepository.findById(id);
    if (!req) throw new HttpError(404, "Service request not found");
    return serviceRequestRepository.delete(id);
  },
};
