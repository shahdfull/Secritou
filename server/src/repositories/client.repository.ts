// Client Repository - Data access layer
import { prisma } from "../config/prisma.js";
import type { Client } from "@prisma/client";

export const clientRepository = {
  async findAll(companyId: string): Promise<Client[]> {
    return prisma.client.findMany({ where: { companyId }, include: { projects: true } });
  },

  async findById(id: string, companyId: string): Promise<Client | null> {
    return prisma.client.findUnique({ where: { id, companyId }, include: { projects: true } });
  },

  async create(data: {
    name: string;
    email?: string;
    phone?: string;
    companyId: string;
  }): Promise<Client> {
    return prisma.client.create({ data });
  },

  async update(id: string, companyId: string, data: Partial<{
    name?: string;
    email?: string;
    phone?: string;
  }>): Promise<Client> {
    return prisma.client.update({ where: { id, companyId }, data });
  },

  async delete(id: string, companyId: string): Promise<Client> {
    return prisma.client.delete({ where: { id, companyId } });
  },
};
