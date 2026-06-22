// Service for Clients - Business logic
import type { CreateClientDTO } from "../types/entities.js";
import { clientRepository } from "../repositories/client.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { HttpError } from "../utils/httpError.js";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import { enqueueEmail } from "../jobs/queues.js";
import { clientInvitationTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import type { ServiceScope } from "../utils/serviceScope.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const clientService = {
  async getClients(
    companyId: string,
    options: ListQueryOptions & { includeArchived?: boolean },
    scope?: ServiceScope
  ) {
    // MANAGER sees only clients with a project in their service; ADMIN sees all.
    const serviceId =
      scope?.userRole === "MANAGER" ? (scope.userServiceId ?? "__none__") : undefined;
    return clientRepository.findAll(companyId, { ...options, serviceId });
  },

  async getClient(id: string, companyId: string, scope?: ServiceScope) {
    const serviceId =
      scope?.userRole === "MANAGER" ? (scope.userServiceId ?? "__none__") : undefined;
    const client = await clientRepository.findById(id, companyId, serviceId);
    if (!client) throw new HttpError(404, "Client not found");
    return client;
  },

  async createClient(data: CreateClientDTO, companyId: string) {
    const client = await clientRepository.create({ ...data, companyId });
    await invalidateTags([cacheTags.company(companyId), cacheTags.dashboard(companyId)]);
    return client;
  },

  async updateClient(id: string, data: Partial<CreateClientDTO>, companyId: string) {
    const client = await clientRepository.findById(id, companyId);
    if (!client) throw new HttpError(404, "Client not found");
    const updated = await clientRepository.update(id, companyId, data);
    await invalidateTags([
      cacheTags.company(companyId),
      cacheTags.dashboard(companyId),
      cacheTags.client(companyId, id),
    ]);
    return updated;
  },

  async deleteClient(id: string, companyId: string) {
    const client = await clientRepository.findById(id, companyId);
    if (!client) throw new HttpError(404, "Client not found");

    // Hard-deleting a client cascades to its invoices (financial records). Block it when
    // any invoice exists — even DRAFT/CANCELLED — and steer callers toward archiving instead.
    const invoiceCount = await clientRepository.countInvoices(id, companyId);
    if (invoiceCount > 0) {
      throw new HttpError(
        409,
        "Client has invoices and cannot be deleted; archive the client instead",
        "CLIENT_HAS_INVOICES"
      );
    }

    const deleted = await clientRepository.delete(id, companyId);
    await invalidateTags([
      cacheTags.company(companyId),
      cacheTags.dashboard(companyId),
      cacheTags.client(companyId, id),
    ]);
    return deleted;
  },

  async archiveClient(id: string, companyId: string) {
    const client = await clientRepository.findById(id, companyId);
    if (!client) throw new HttpError(404, "Client not found");
    const archived = await clientRepository.archive(id, companyId);
    await invalidateTags([
      cacheTags.company(companyId),
      cacheTags.dashboard(companyId),
      cacheTags.client(companyId, id),
    ]);
    return archived;
  },

  async inviteClientUser(
    clientId: string,
    companyId: string,
    email: string,
    name: string
  ) {
    const client = await clientRepository.findById(clientId, companyId);
    if (!client) throw new HttpError(404, "Client not found");

    const existing = await userRepository.findByClientId(clientId);
    if (existing.length > 0) {
      throw new HttpError(409, "Client already has a portal account");
    }

    const tempPassword = crypto.randomBytes(16).toString("base64url").slice(0, 16);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await userRepository.create({
      email,
      name,
      role: "CLIENT",
      companyId,
      clientId,
      passwordHash,
      mustChangePassword: true,
    });

    const { subject, html } = clientInvitationTemplate({
      name,
      email,
      tempPassword,
      loginUrl: `${env.FRONTEND_URL}/login`,
      companyName: client.name,
    });
    void enqueueEmail({ to: email, subject, html });

    return { user };
  },
};
