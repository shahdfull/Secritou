// Service for Clients - Business logic
import type { CreateClientDTO } from "../types/entities.js";
import { clientRepository } from "../repositories/client.repository.js";
import { HttpError } from "../utils/httpError.js";

export const clientService = {
  async getClients(companyId: string) {
    return clientRepository.findAll(companyId);
  },

  async getClient(id: string, companyId: string) {
    const client = await clientRepository.findById(id, companyId);
    if (!client) throw new HttpError(404, "Client not found");
    return client;
  },

  async createClient(data: CreateClientDTO, companyId: string) {
    return clientRepository.create({ ...data, companyId });
  },

  async updateClient(id: string, data: Partial<CreateClientDTO>, companyId: string) {
    const client = await clientRepository.findById(id, companyId);
    if (!client) throw new HttpError(404, "Client not found");
    return clientRepository.update(id, companyId, data);
  },

  async deleteClient(id: string, companyId: string) {
    const client = await clientRepository.findById(id, companyId);
    if (!client) throw new HttpError(404, "Client not found");
    return clientRepository.delete(id, companyId);
  },
};
