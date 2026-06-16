// Lead Service - Business logic
import type { CreateLeadDTO } from "../types/entities.js";
import { leadRepository } from "../repositories/lead.repository.js";
import { clientRepository } from "../repositories/client.repository.js";
import { HttpError } from "../utils/httpError.js";

export const leadService = {
  async getLeads(companyId: string) {
    return leadRepository.findAll(companyId);
  },

  async getLead(id: string, companyId: string) {
    const lead = await leadRepository.findById(id, companyId);
    if (!lead) throw new HttpError(404, "Lead not found");
    return lead;
  },

  async createLead(data: CreateLeadDTO, companyId: string) {
    return leadRepository.create({ ...data, companyId });
  },

  async updateLead(id: string, data: Partial<CreateLeadDTO>, companyId: string) {
    const lead = await leadRepository.findById(id, companyId);
    if (!lead) throw new HttpError(404, "Lead not found");
    return leadRepository.update(id, companyId, data);
  },

  async deleteLead(id: string, companyId: string) {
    const lead = await leadRepository.findById(id, companyId);
    if (!lead) throw new HttpError(404, "Lead not found");
    return leadRepository.delete(id, companyId);
  },

  async convertLeadToClient(id: string, companyId: string) {
    const lead = await leadRepository.findById(id, companyId);
    if (!lead) throw new HttpError(404, "Lead not found");

    // Create client from lead
    const client = await clientRepository.create({
      name: lead.name,
      email: lead.email ?? undefined,
      phone: lead.phone ?? undefined,
      companyId: lead.companyId,
    });

    // Mark lead as WON and/or delete it
    await leadRepository.update(id, companyId, { status: "WON" });
    await leadRepository.delete(id, companyId);

    return client;
  },
};
