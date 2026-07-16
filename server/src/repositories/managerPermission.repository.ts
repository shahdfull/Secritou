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
    overrides?: any;
  }): Promise<ManagerPermission> {
    return prisma.managerPermission.create({
      data,
      include: { profile: true },
    });
  },

  async update(
    userId: string,
    data: Prisma.ManagerPermissionUpdateInput
  ): Promise<ManagerPermission> {
    return prisma.managerPermission.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data,
      },
      include: { profile: true },
    });
  },
};
