// Permission Profile Repository - Data access layer
import { prisma } from "../config/prisma.js";
import type { PermissionProfile, Prisma } from "@prisma/client";

export const permissionProfileRepository = {
  async findAll(): Promise<PermissionProfile[]> {
    return prisma.permissionProfile.findMany({
      orderBy: { createdAt: "desc" },
    });
  },

  async findById(id: string): Promise<PermissionProfile | null> {
    return prisma.permissionProfile.findUnique({
      where: { id },
    });
  },

  async create(data: {
    name: string;
    description?: string;
    permissions: any;
    isDefault?: boolean;
  }): Promise<PermissionProfile> {
    return prisma.permissionProfile.create({
      data,
    });
  },

  async update(
    id: string,
    data: Prisma.PermissionProfileUncheckedUpdateInput
  ): Promise<PermissionProfile> {
    return prisma.permissionProfile.update({
      where: { id },
      data,
    });
  },

  async delete(id: string): Promise<PermissionProfile> {
    return prisma.permissionProfile.delete({
      where: { id },
    });
  },
};
