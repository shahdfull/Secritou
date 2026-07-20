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
  async getClients(options: ListQueryOptions & { includeArchived?: boolean }, scope?: ServiceScope) {
    const serviceId = scope?.userRole === "MANAGER" ? (scope.userServiceId ?? "__none__") : undefined;
    return clientRepository.findAll({ ...options, serviceId });
  },

  async getDeletedClients(options: ListQueryOptions, scope?: ServiceScope) {
    const serviceId = scope?.userRole === "MANAGER" ? (scope.userServiceId ?? "__none__") : undefined;
    return clientRepository.findDeleted({ ...options, serviceId });
  },

  async getClient(id: string, scope?: ServiceScope, includeArchived?: boolean) {
    const serviceId = scope?.userRole === "MANAGER" ? (scope.userServiceId ?? "__none__") : undefined;
    const client = await clientRepository.findById(id, serviceId, includeArchived);
    if (!client) throw new HttpError(404, "Client not found");
    return client;
  },

  async createClient(data: CreateClientDTO) {
    const client = await clientRepository.create(data);
    await invalidateTags([cacheTags.company(), cacheTags.dashboard()]);
    return client;
  },

  async updateClient(id: string, data: Partial<CreateClientDTO>) {
    const client = await clientRepository.findById(id);
    if (!client) throw new HttpError(404, "Client not found");
    const updated = await clientRepository.update(id, data);
    await invalidateTags([cacheTags.company(), cacheTags.dashboard(), cacheTags.client(id)]);
    return updated;
  },

  async deleteClient(id: string) {
    const client = await clientRepository.findById(id);
    if (!client) throw new HttpError(404, "Client not found");

    // Hard-deleting a client cascades to its invoices (financial records). Block it when
    // any invoice exists and steer callers toward archiving instead.
    const invoiceCount = await clientRepository.countInvoices(id);
    if (invoiceCount > 0) {
      throw new HttpError(409, "Client has invoices and cannot be deleted; archive the client instead", "CLIENT_HAS_INVOICES");
    }

    const deleted = await clientRepository.delete(id);
    await invalidateTags([cacheTags.company(), cacheTags.dashboard(), cacheTags.client(id)]);
    return deleted;
  },

  async restoreClient(id: string) {
    const client = await clientRepository.findById(id, undefined, true);
    if (!client) throw new HttpError(404, "Client not found");
    const restored = await clientRepository.restore(id);
    await invalidateTags([cacheTags.company(), cacheTags.dashboard(), cacheTags.client(id)]);
    return restored;
  },

  async archiveClient(id: string) {
    const client = await clientRepository.findById(id);
    if (!client) throw new HttpError(404, "Client not found");
    const archived = await clientRepository.archive(id);
    await invalidateTags([cacheTags.company(), cacheTags.dashboard(), cacheTags.client(id)]);
    return archived;
  },

  // SEC-154: a client whose invitation email never arrived (SMTP down at invite time) was
  // permanently stuck — this always 409'd once the User row existed, with no ADMIN-facing way
  // to get them a fresh invite short of the client guessing they should try forgot-password.
  // `lastLoginAt: null` means the account has never actually been used — the original temp
  // password was never consumed, so it's safe to reissue rather than a real re-invite of an
  // active account.
  async inviteClientUser(clientId: string, email: string, name: string) {
    const client = await clientRepository.findById(clientId);
    if (!client) throw new HttpError(404, "Client not found");

    const existing = await userRepository.findByClientId(clientId);
    if (existing.length > 0) {
      const neverLoggedIn = existing.find((u) => u.lastLoginAt === null);
      if (!neverLoggedIn) throw new HttpError(409, "Client already has a portal account");

      const tempPassword = crypto.randomBytes(16).toString("base64url").slice(0, 16);
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      const user = await userRepository.update(neverLoggedIn.id, { passwordHash, mustChangePassword: true });

      const { subject, html } = clientInvitationTemplate({ name: user.name, email: user.email, tempPassword, loginUrl: `${env.FRONTEND_URL}/login`, companyName: client.name });
      void enqueueEmail({ to: user.email, subject, html });

      return { user, resent: true };
    }

    const tempPassword = crypto.randomBytes(16).toString("base64url").slice(0, 16);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await userRepository.create({ email, name, role: "CLIENT", clientId, passwordHash, mustChangePassword: true });

    const { subject, html } = clientInvitationTemplate({ name, email, tempPassword, loginUrl: `${env.FRONTEND_URL}/login`, companyName: client.name });
    void enqueueEmail({ to: email, subject, html });

    return { user, resent: false };
  },
};
