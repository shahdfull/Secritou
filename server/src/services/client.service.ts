// Service for Clients - Business logic
import type { CreateClientDTO } from "../types/entities.js";
import { clientRepository } from "../repositories/client.repository.js";
import { HttpError } from "../utils/httpError.js";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";

export const clientService = {
  async getClients(companyId: string, options: ListQueryOptions) {
    return clientRepository.findAll(companyId, options);
  },

  async getClient(id: string, companyId: string) {
    const client = await clientRepository.findById(id, companyId);
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
    const deleted = await clientRepository.delete(id, companyId);
    await invalidateTags([
      cacheTags.company(companyId),
      cacheTags.dashboard(companyId),
      cacheTags.client(companyId, id),
    ]);
    return deleted;
  },
};
