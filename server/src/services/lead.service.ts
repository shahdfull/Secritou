// Lead Service - Business logic
import type { CreateLeadDTO } from "../types/entities.js";
import { leadRepository, type LeadScope } from "../repositories/lead.repository.js";
import { HttpError } from "../utils/httpError.js";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { prisma } from "../config/prisma.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";

async function invalidateCompanyCache() {
  await invalidateTags([cacheTags.company(), cacheTags.dashboard()]);
}

export const leadService = {
  async getLeads(options: ListQueryOptions, scope?: LeadScope) {
    return leadRepository.findAll(options, scope);
  },

  async getLead(id: string, scope?: LeadScope) {
    const lead = await leadRepository.findByIdWithProposals(id, scope);
    if (!lead) throw new HttpError(404, "Lead not found");
    return lead;
  },

  async createLead(data: CreateLeadDTO) {
    const lead = await leadRepository.create(data);
    await invalidateCompanyCache();
    return lead;
  },

  async updateLead(id: string, data: Partial<CreateLeadDTO>, scope?: LeadScope) {
    const lead = await leadRepository.findById(id, scope);
    if (!lead) throw new HttpError(404, "Lead not found");
    const updated = await leadRepository.update(id, data);
    await invalidateCompanyCache();
    return updated;
  },

  async deleteLead(id: string, scope?: LeadScope) {
    const lead = await leadRepository.findById(id, scope);
    if (!lead) throw new HttpError(404, "Lead not found");
    // A converted lead is the origin record of an existing client : deleting it would erase
    // that provenance. Block it; the lead is already archived on conversion anyway.
    if (lead.convertedClientId) {
      throw new HttpError(409, "Cannot delete a converted lead", "LEAD_ALREADY_CONVERTED");
    }
    const deleted = await leadRepository.delete(id);
    await invalidateCompanyCache();
    return deleted;
  },

  async convertLeadToClient(id: string, scope?: LeadScope) {
    const lead = await leadRepository.findById(id, scope);
    if (!lead) throw new HttpError(404, "Lead not found");

    // Email is the uniqueness key for clients. A lead without an email cannot be converted.
    if (!lead.email) {
      throw new HttpError(422, "Lead has no email : an email is required to convert to a client", "LEAD_EMAIL_REQUIRED");
    }

    const client = await prisma.$transaction(async (tx) => {
      // Re-read inside the transaction and guard against double-conversion.
      const current = await tx.lead.findUnique({ where: { id }, select: { convertedClientId: true } });
      if (!current) throw new HttpError(404, "Lead not found");
      if (current.convertedClientId) throw new HttpError(409, "Lead already converted", "LEAD_ALREADY_CONVERTED");

      // Enforce email uniqueness before creating.
      const existing = await tx.client.findUnique({ where: { email: lead.email! }, select: { id: true } });
      if (existing) {
        throw new HttpError(409, "A client with this email already exists : merge or cancel", "CLIENT_EMAIL_EXISTS", { clientId: existing.id });
      }

      const created = await tx.client.create({
        data: { name: lead.name, email: lead.email ?? undefined, phone: lead.phone ?? undefined },
      });

      await tx.lead.update({ where: { id }, data: { status: "WON", archivedAt: new Date(), convertedClientId: created.id } });

      return created;
    });

    await invalidateCompanyCache();
    return client;
  },
};
