// Lead Service - Business logic
import type { CreateLeadDTO } from "../types/entities.js";
import { leadRepository } from "../repositories/lead.repository.js";
import { HttpError } from "../utils/httpError.js";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { prisma } from "../config/prisma.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";

async function invalidateCompanyCache(companyId: string) {
  await invalidateTags([cacheTags.company(companyId), cacheTags.dashboard(companyId)]);
}

export const leadService = {
  async getLeads(companyId: string, options: ListQueryOptions) {
    return leadRepository.findAll(companyId, options);
  },

  async getLead(id: string, companyId: string) {
    const lead = await leadRepository.findById(id, companyId);
    if (!lead) throw new HttpError(404, "Lead not found");
    return lead;
  },

  async createLead(data: CreateLeadDTO, companyId: string) {
    const lead = await leadRepository.create({ ...data, companyId });
    await invalidateCompanyCache(companyId);
    return lead;
  },

  async updateLead(id: string, data: Partial<CreateLeadDTO>, companyId: string) {
    const lead = await leadRepository.findById(id, companyId);
    if (!lead) throw new HttpError(404, "Lead not found");
    const updated = await leadRepository.update(id, companyId, data);
    await invalidateCompanyCache(companyId);
    return updated;
  },

  async deleteLead(id: string, companyId: string) {
    const lead = await leadRepository.findById(id, companyId);
    if (!lead) throw new HttpError(404, "Lead not found");
    const deleted = await leadRepository.delete(id, companyId);
    await invalidateCompanyCache(companyId);
    return deleted;
  },

  async convertLeadToClient(id: string, companyId: string) {
    const lead = await leadRepository.findById(id, companyId);
    if (!lead) throw new HttpError(404, "Lead not found");

    const client = await prisma.$transaction(async (tx) => {
      // Re-read inside the transaction and guard against double-conversion. Without this, a
      // second /convert call would create a duplicate Client and orphan the first one.
      const current = await tx.lead.findUnique({
        where: { id, companyId },
        select: { convertedClientId: true },
      });
      if (!current) throw new HttpError(404, "Lead not found");
      if (current.convertedClientId) {
        throw new HttpError(409, "Lead already converted", "LEAD_ALREADY_CONVERTED");
      }

      const created = await tx.client.create({
        data: {
          name: lead.name,
          email: lead.email ?? undefined,
          phone: lead.phone ?? undefined,
          companyId: lead.companyId,
        },
      });

      await tx.lead.update({
        where: { id, companyId },
        data: { status: "WON", archivedAt: new Date(), convertedClientId: created.id },
      });

      return created;
    });

    await invalidateCompanyCache(companyId);
    return client;
  },
};
