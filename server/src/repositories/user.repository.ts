// User Repository - Data access layer
import { prismaRead as prisma } from "../config/prisma.js";
import type { User, Role, Prisma } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

const userPublicFields = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  clientId: true,
  mustChangePassword: true,
  lastLoginAt: true,
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
      select: userPublicFields,
    });
  },

  // Lightweight lookup of a user's service (pole) for request scoping, without inflating PublicUser.
  async findServiceId(id: string): Promise<string | null> {
    const user = await prisma.user.findUnique({ where: { id }, select: { serviceId: true } });
    return user?.serviceId ?? null;
  },

  async countByRole(role: Role): Promise<number> {
    return prisma.user.count({ where: { role } });
  },

  async findAll(options: ListQueryOptions): Promise<PaginatedResult<PublicUser>> {
    const skip = (options.page - 1) * options.pageSize;
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        select: userPublicFields,
        orderBy: { createdAt: "desc" },
        skip,
        take: options.pageSize,
      }),
      prisma.user.count(),
    ]);
    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findByClientId(clientId: string): Promise<PublicUser[]> {
    return prisma.user.findMany({
      where: { clientId },
      select: userPublicFields,
    });
  },

  async findAdmins(): Promise<PublicUser[]> {
    return prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MANAGER"] } },
      select: userPublicFields,
    });
  },

  // ADMINs (unscoped) plus only the MANAGER(s) assigned to the given pole — narrower than
  // findAdmins(), which returns every manager regardless of pole. Used for alerts that should
  // reach the pole owner without also spamming every other associate's inbox.
  async findAdminsAndPoleManagers(serviceId: string | null): Promise<PublicUser[]> {
    return prisma.user.findMany({
      where: {
        OR: [
          { role: "ADMIN" },
          { role: "MANAGER", serviceId: serviceId ?? "__none__" },
        ],
      },
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
    clientId?: string;
    mustChangePassword?: boolean;
  }): Promise<PublicUser> {
    return prisma.user.create({
      data,
      select: userPublicFields,
    });
  },

  async update(
    id: string,
    data: Prisma.UserUncheckedUpdateInput
  ): Promise<PublicUser> {
    return prisma.user.update({
      where: { id },
      data,
      select: userPublicFields,
    });
  },

  async updateMe(
    id: string,
    data: Prisma.UserUncheckedUpdateInput
  ): Promise<PublicUser> {
    return prisma.user.update({
      where: { id },
      data,
      select: userPublicFields,
    });
  },

  async findByEmailExcluding(email: string, excludeId: string): Promise<{ id: string } | null> {
    return prisma.user.findFirst({
      where: { email, NOT: { id: excludeId } },
      select: { id: true },
    });
  },

  async stageEmailChange(id: string, pendingEmail: string, tokenHash: string, expiry: Date): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { pendingEmail, emailChangeTokenHash: tokenHash, emailChangeTokenExpiry: expiry },
    });
  },

  async findByEmailChangeTokenHash(tokenHash: string): Promise<{ id: string; pendingEmail: string | null } | null> {
    return prisma.user.findFirst({
      where: { emailChangeTokenHash: tokenHash, emailChangeTokenExpiry: { gt: new Date() } },
      select: { id: true, pendingEmail: true },
    });
  },

  async confirmEmailChange(id: string, newEmail: string): Promise<PublicUser> {
    return prisma.user.update({
      where: { id },
      data: { email: newEmail, pendingEmail: null, emailChangeTokenHash: null, emailChangeTokenExpiry: null },
      select: userPublicFields,
    });
  },

  async delete(id: string): Promise<PublicUser> {
    // Explicitly delete refresh tokens first to ensure revocation
    await prisma.refreshToken.deleteMany({ where: { userId: id } });
    return prisma.user.delete({
      where: { id },
      select: userPublicFields,
    });
  },
};
