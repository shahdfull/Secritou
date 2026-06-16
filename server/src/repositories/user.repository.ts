// User Repository - Data access layer
import { prisma } from "../config/prisma.js";
import type { User, Role } from "@prisma/client";

export const userRepository = {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  async findByCompanyId(companyId: string): Promise<User[]> {
    return prisma.user.findMany({ where: { companyId } });
  },

  async create(data: {
    email: string;
    name: string;
    passwordHash: string;
    role?: Role;
    companyId?: string;
  }): Promise<User> {
    return prisma.user.create({ data });
  },

  async update(id: string, data: Partial<{
    name?: string;
    role?: Role;
  }>): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  },

  async delete(id: string): Promise<User> {
    return prisma.user.delete({ where: { id } });
  },
};
