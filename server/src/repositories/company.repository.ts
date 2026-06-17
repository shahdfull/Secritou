// Company Repository - Data access layer
import { prisma } from "../config/prisma.js";
import type { Company } from "@prisma/client";

const companySelect = {
  id: true,
  name: true,
  website: true,
  logoUrl: true,
  primaryColor: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const companyRepository = {
  async findById(id: string): Promise<Company | null> {
    return prisma.company.findUnique({ where: { id }, select: companySelect });
  },

  async create(data: { name: string; website?: string; logoUrl?: string; primaryColor?: string }): Promise<Company> {
    return prisma.company.create({ data, select: companySelect });
  },

  async update(id: string, data: Partial<{ name?: string; website?: string; logoUrl?: string; primaryColor?: string }>): Promise<Company> {
    return prisma.company.update({ where: { id }, data, select: companySelect });
  },

  async delete(id: string): Promise<Company> {
    return prisma.company.delete({ where: { id }, select: companySelect });
  },
};
