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
