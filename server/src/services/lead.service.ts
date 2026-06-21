// Lead Service - Business logic
import type { CreateLeadDTO } from "../types/entities.js";
import { leadRepository, type LeadScope } from "../repositories/lead.repository.js";
import { HttpError } from "../utils/httpError.js";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { prisma } from "../config/prisma.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";

async function invalidateCompanyCache(companyId: string) {
  await invalidateTags([cacheTags.company(companyId), cacheTags.dashboard(companyId)]);
}

export const leadService = {
  async getLeads(companyId: string, options: ListQueryOptions, scope?: LeadScope) {
    return leadRepository.findAll(companyId, options, scope);
  },

  async getLead(id: string, companyId: string, scope?: LeadScope) {
    const lead = await leadRepository.findById(id, companyId, scope);
    if (!lead) throw new HttpError(404, "Lead not found");
    return lead;
  },

  async createLead(data: CreateLeadDTO, companyId: string) {
    const lead = await leadRepository.create({ ...data, companyId });
    await invalidateCompanyCache(companyId);
    return lead;
  },

  async updateLead(id: string, data: Partial<CreateLeadDTO>, companyId: string, scope?: LeadScope) {
    const lead = await leadRepository.findById(id, companyId, scope);
    if (!lead) throw new HttpError(404, "Lead not found");
    const updated = await leadRepository.update(id, companyId, data);
    await invalidateCompanyCache(companyId);
    return updated;
  },

  async deleteLead(id: string, companyId: string, scope?: LeadScope) {
    const lead = await leadRepository.findById(id, companyId, scope);
    if (!lead) throw new HttpError(404, "Lead not found");
    // A converted lead is the origin record of an existing client — deleting it would erase
    // that provenance. Block it; the lead is already archived on conversion anyway.
    if (lead.convertedClientId) {
      throw new HttpError(409, "Cannot delete a converted lead", "LEAD_ALREADY_CONVERTED");
    }
    const deleted = await leadRepository.delete(id, companyId);
    await invalidateCompanyCache(companyId);
    return deleted;
  },

  async convertLeadToClient(id: string, companyId: string, scope?: LeadScope) {
    const lead = await leadRepository.findById(id, companyId, scope);
    if (!lead) throw new HttpError(404, "Lead not found");

    // Email is the per-company uniqueness key for clients. A lead without an email cannot be
    // converted, otherwise we'd create clients that bypass the (companyId, email) constraint.
    if (!lead.email) {
      throw new HttpError(
        422,
        "Lead has no email — an email is required to convert to a client",
        "LEAD_EMAIL_REQUIRED",
      );
    }

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

      // Enforce email uniqueness within the company before creating. Without this, the
      // create below would throw a raw Prisma P2002 (surfaced as a 500). Instead we block
      // with an explicit business error so the client can choose to merge or cancel.
      const existing = await tx.client.findUnique({
        where: { companyId_email: { companyId, email: lead.email! } },
        select: { id: true },
      });
      if (existing) {
        throw new HttpError(
          409,
          "A client with this email already exists — merge or cancel",
          "CLIENT_EMAIL_EXISTS",
          { clientId: existing.id },
        );
      }

      // A client is not tagged with a single service (it may buy from several poles), so the
      // lead's pole is not copied onto the client. It is carried by the projects created later.
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
