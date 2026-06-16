// Lead Repository - Data access layer
import { prisma } from "../config/prisma.js";
import type { Lead, LeadStatus } from "@prisma/client";

export const leadRepository = {
  async findAll(companyId: string): Promise<Lead[]> {
    return prisma.lead.findMany({ where: { companyId } });
  },

  async findById(id: string, companyId: string): Promise<Lead | null> {
    return prisma.lead.findUnique({ where: { id, companyId } });
  },

  async create(data: {
    name: string;
    email?: string;
    phone?: string;
    source?: string;
    status?: LeadStatus;
    notes?: string;
    companyId: string;
  }): Promise<Lead> {
    return prisma.lead.create({ data });
  },

  async update(id: string, companyId: string, data: Partial<{
    name?: string;
    email?: string;
    phone?: string;
    source?: string;
    status?: LeadStatus;
    notes?: string;
  }>): Promise<Lead> {
    return prisma.lead.update({ where: { id, companyId }, data });
  },

  async delete(id: string, companyId: string): Promise<Lead> {
    return prisma.lead.delete({ where: { id, companyId } });
  },
};
