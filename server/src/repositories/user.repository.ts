// User Repository - Data access layer
import { prismaRead as prisma } from "../config/prisma.js";
import { COMPANY_ID } from "../config/constants.js";
import type { User, Role } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

const userPublicFields = {
  id: true,
  email: true,
  name: true,
  role: true,
  companyId: true,
  clientId: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PublicUser = Pick<User, keyof typeof userPublicFields>;

export const userRepository = {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { email } });
  },

  async findById(id: string): Promise<PublicUser | null> {
    return prisma.user.findFirst({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        clientId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  // Lightweight lookup of a user's service (pole) for request scoping, without inflating PublicUser.
  async findServiceId(id: string): Promise<string | null> {
    const user = await prisma.user.findUnique({ where: { id }, select: { serviceId: true } });
    return user?.serviceId ?? null;
  },

  async findByCompanyId(companyId: string = COMPANY_ID, options: ListQueryOptions): Promise<PaginatedResult<PublicUser>> {
    const where = { companyId };
    const skip = (options.page - 1) * options.pageSize;

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userPublicFields,
        orderBy: { createdAt: "desc" },
        skip,
        take: options.pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findByClientId(clientId: string): Promise<PublicUser[]> {
    return prisma.user.findMany({
      where: { clientId },
      select: userPublicFields,
    });
  },

  async findAdminsByCompanyId(companyId: string = COMPANY_ID): Promise<PublicUser[]> {
    return prisma.user.findMany({
      where: { companyId, role: { in: ["ADMIN", "MANAGER"] } },
      select: userPublicFields,
    });
  },

  async findByRole(role: Role): Promise<PublicUser[]> {
    return prisma.user.findMany({ where: { role }, select: userPublicFields });
  },

  async create(data: {
    email: string;
    name: string;
    passwordHash: string;
    role?: Role;
    companyId?: string;
    clientId?: string;
    mustChangePassword?: boolean;
  }): Promise<PublicUser> {
    return prisma.user.create({
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        clientId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async update(
    id: string,
    data: Partial<{
      name?: string;
      role?: Role;
    }>
  ): Promise<PublicUser> {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        clientId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async updateMe(
    id: string,
    data: Partial<{ name: string; email: string; phone: string }>
  ): Promise<PublicUser> {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        clientId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async findByEmailExcluding(email: string, excludeId: string): Promise<{ id: string } | null> {
    return prisma.user.findFirst({
      where: { email, NOT: { id: excludeId } },
      select: { id: true },
    });
  },

  async delete(id: string): Promise<PublicUser> {
    return prisma.user.delete({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        clientId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },
};
