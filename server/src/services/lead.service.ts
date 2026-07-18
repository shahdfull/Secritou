// Lead Service - Business logic
import logger from "../utils/logger.js";
import type { CreateLeadDTO } from "../types/entities.js";
import { leadRepository, type LeadScope } from "../repositories/lead.repository.js";
import { HttpError } from "../utils/httpError.js";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { prisma } from "../config/prisma.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueNotifications } from "../jobs/queues.js";
import { env } from "../config/env.js";
import { clientService } from "./client.service.js";
import { notifyN8n } from "../utils/webhook.js";

async function invalidateCompanyCache() {
  await invalidateTags([cacheTags.company(), cacheTags.dashboard()]);
}

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Mirrors the pipeline order surfaced in the Kanban board (LeadsKanban.tsx):
// a lead can only move to an adjacent/forward stage or be marked LOST, never
// jump backward or leave a terminal stage. Enforced here so the API rejects
// bad transitions regardless of client (Kanban drag, form edit, future API
// consumers) — the client-side check is UX only, this is the source of truth.
const LEAD_NEXT_STATUSES: Record<string, string[]> = {
  NEW: ["CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"],
  CONTACTED: ["QUALIFIED", "PROPOSAL", "WON", "LOST"],
  QUALIFIED: ["PROPOSAL", "WON", "LOST"],
  PROPOSAL: ["WON", "LOST"],
  WON: [],
  LOST: [],
};

// Shared by the manual "Convert to Client" flow and the automatic conversion that runs inside
// proposal.service.acceptWithCascade's transaction. Marks the lead WON→converted by pointing it
// at an already-existing Client (tx-scoped: caller decides the client, e.g. the proposal's own
// clientId, instead of creating a new one).
export async function linkLeadToClientTx(
  tx: TxClient,
  leadId: string,
  clientId: string
) {
  const current = await tx.lead.findUnique({ where: { id: leadId }, select: { convertedClientId: true } });
  if (!current || current.convertedClientId) return null;
  return tx.lead.update({ where: { id: leadId }, data: { archivedAt: new Date(), convertedClientId: clientId } });
}

export const leadService = {
  async getLeads(options: ListQueryOptions & { includeArchived?: boolean }, scope?: LeadScope) {
    return leadRepository.findAll(options, scope);
  },

  async getLead(id: string, scope?: LeadScope, includeArchived?: boolean) {
    const lead = await leadRepository.findByIdWithProposals(id, scope, includeArchived);
    if (!lead) throw new HttpError(404, "Lead not found");
    return lead;
  },

  async createLead(data: CreateLeadDTO) {
    const lead = await leadRepository.create(data);
    await invalidateCompanyCache();
    
    // Notify admins of new lead creation
    const admins = await userRepository.findAdmins();
    void enqueueNotifications(admins.map((admin) => ({
      userId: admin.id,
      title: "Nouveau lead",
      message: `Un nouveau lead "${lead.name}" a été créé.`,
      type: "GENERAL" as const,
      entityId: lead.id,
      link: `${env.FRONTEND_URL}/app/leads/${lead.id}`,
    })));

    void notifyN8n("lead.created", {
      leadId: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      adminUrl: `${env.FRONTEND_URL}/app/leads/${lead.id}`,
      agencyEmail: env.CONTACT_RECEIVER_EMAIL,
    });

    return lead;
  },

  async updateLead(id: string, data: Partial<CreateLeadDTO>, scope?: LeadScope) {
    const lead = await leadRepository.findById(id, scope);
    if (!lead) throw new HttpError(404, "Lead not found");

    if (data.status && data.status !== lead.status) {
      const allowed = LEAD_NEXT_STATUSES[lead.status] ?? [];
      if (!allowed.includes(data.status)) {
        throw new HttpError(
          422,
          `Cannot move lead from ${lead.status} to ${data.status}`,
          "LEAD_INVALID_TRANSITION"
        );
      }
      // A WON lead already converted to a client is that client's origin record;
      // even though WON has no allowed next status above, guard explicitly in
      // case the transition table changes later.
      if (lead.convertedClientId) {
        throw new HttpError(409, "Cannot change status of a converted lead", "LEAD_ALREADY_CONVERTED");
      }
    }

    const updated = await leadRepository.update(id, data);
    await invalidateCompanyCache();

    if (data.status === "LOST" && lead.status !== "LOST") {
      const admins = await userRepository.findAdmins();
      void enqueueNotifications(admins.map((admin) => ({
        userId: admin.id,
        title: "Lead perdu",
        message: `Le lead "${lead.name}" a été marqué comme perdu.${data.lostReason ? ` Raison : ${data.lostReason}` : ""}`,
        type: "GENERAL" as const,
        entityId: id,
        link: `${env.FRONTEND_URL}/app/leads`,
      })));
    }

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

  async reopenLead(id: string, scope?: LeadScope) {
    const lead = await leadRepository.findById(id, scope, true); // Allow finding archived leads
    if (!lead) throw new HttpError(404, "Lead not found");

    if (lead.convertedClientId) {
      throw new HttpError(409, "Cannot reopen a lead that was converted to a client", "LEAD_ALREADY_CONVERTED");
    }

    const updated = await leadRepository.update(id, { status: "NEW", archivedAt: null });
    await invalidateCompanyCache();
    return updated;
  },

  async convertLeadToClient(id: string, scope?: LeadScope) {
    const lead = await leadRepository.findById(id, scope);
    if (!lead) throw new HttpError(404, "Lead not found");

    if (lead.status !== "WON") {
      throw new HttpError(422, "Only a WON lead can be converted to a client", "LEAD_NOT_WON");
    }

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
        data: { 
          name: lead.name, 
          email: lead.email ?? undefined, 
          phone: lead.phone ?? undefined,
          serviceId: lead.serviceId ?? undefined // Copy serviceId from lead to client
        },
      });

      await tx.lead.update({ where: { id }, data: { archivedAt: new Date(), convertedClientId: created.id } });

      return created;
    });

    await invalidateCompanyCache();

    const admins = await userRepository.findAdmins();
    void enqueueNotifications(admins.map((admin) => ({
      userId: admin.id,
      title: "Lead converti en client",
      message: `Le lead "${lead.name}" a été converti en client.`,
      type: "LEAD_CONVERTED" as const,
      entityId: client.id,
      link: `${env.FRONTEND_URL}/app/clients/${client.id}`,
    })));

    // Auto-invite client user if we have email and name
    try {
      await clientService.inviteClientUser(client.id, lead.email, lead.name);
    } catch (err) {
      // If user already invited (e.g., existing client merged), just log it and continue
      if (!(err instanceof HttpError && err.code === "CLIENT_EMAIL_EXISTS")) {
        logger.error({ err }, "Failed to auto-invite client user");
      }
    }

    return client;
  },
};
