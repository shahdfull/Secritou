// Company Repository - Data access layer
import { prisma } from "../config/prisma.js";
import type { Company } from "@prisma/client";

export const companyRepository = {
  async findById(id: string): Promise<Company | null> {
    return prisma.company.findUnique({ where: { id } });
  },

  async create(data: { name: string; website?: string }): Promise<Company> {
    return prisma.company.create({ data });
  },

  async update(id: string, data: Partial<{ name?: string; website?: string }>): Promise<Company> {
    return prisma.company.update({ where: { id }, data });
  },

  async delete(id: string): Promise<Company> {
    return prisma.company.delete({ where: { id } });
  },
};
