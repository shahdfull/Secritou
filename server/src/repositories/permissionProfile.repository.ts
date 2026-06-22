// Permission Profile Repository - Data access layer
import { prismaRead as prisma } from "../config/prisma.js";
import { prismaWrite } from "../config/prisma.js";
import type { PermissionProfile } from "@prisma/client";

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
    return prismaWrite.permissionProfile.create({
      data,
    });
  },

  async update(
    id: string,
    data: Partial<{
      name?: string;
      description?: string;
      permissions?: any;
      isDefault?: boolean;
    }>
  ): Promise<PermissionProfile> {
    return prismaWrite.permissionProfile.update({
      where: { id },
      data,
    });
  },

  async delete(id: string): Promise<PermissionProfile> {
    return prismaWrite.permissionProfile.delete({
      where: { id },
    });
  },
};
