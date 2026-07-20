// Manager Permission Repository - Data access layer
import { prisma } from "../config/prisma.js";
import type { ManagerPermission, Prisma } from "@prisma/client";

export const managerPermissionRepository = {
  async findByUserId(userId: string): Promise<ManagerPermission | null> {
    return prisma.managerPermission.findUnique({
      where: { userId },
      include: { profile: true },
    });
  },

  async findUserIdsByProfileId(profileId: string): Promise<string[]> {
    const rows = await prisma.managerPermission.findMany({
      where: { profileId },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  },

  // SEC-114: used to block PermissionProfile deletion with a useful message — names, not just
  // ids, so the ADMIN making the call can actually tell who would be affected.
  async findUserNamesByProfileId(profileId: string): Promise<string[]> {
    const rows = await prisma.managerPermission.findMany({
      where: { profileId },
      select: { user: { select: { name: true } } },
    });
    return rows.map((row) => row.user.name);
  },

  async create(data: {
    userId: string;
    profileId?: string;
    overrides?: Prisma.InputJsonValue;
  }): Promise<ManagerPermission> {
    return prisma.managerPermission.create({
      data,
      include: { profile: true },
    });
  },

  async update(
    userId: string,
    data: Prisma.ManagerPermissionUncheckedUpdateInput
  ): Promise<ManagerPermission> {
    return prisma.managerPermission.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        profileId: typeof data.profileId === "string" || data.profileId === null ? data.profileId : undefined,
        overrides: data.overrides as Prisma.InputJsonValue | undefined,
      },
      include: { profile: true },
    });
  },
};
