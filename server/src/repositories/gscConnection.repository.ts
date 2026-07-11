import { prisma, prismaRead } from "../config/prisma.js";

export const gscConnectionRepository = {
  async findByClientId(clientId: string) {
    return prismaRead.gscConnection.findUnique({ where: { clientId } });
  },

  async findAll() {
    return prismaRead.gscConnection.findMany({ select: { id: true, clientId: true, siteUrl: true, lastSyncedAt: true, lastSyncError: true } });
  },

  async upsert(
    clientId: string,
    data: { siteUrl: string; encryptedRefreshToken: string; encryptedAccessToken?: string; accessTokenExpiresAt?: Date; connectedById: string }
  ) {
    return prisma.gscConnection.upsert({
      where: { clientId },
      create: { clientId, ...data },
      update: {
        siteUrl: data.siteUrl,
        encryptedRefreshToken: data.encryptedRefreshToken,
        encryptedAccessToken: data.encryptedAccessToken,
        accessTokenExpiresAt: data.accessTokenExpiresAt,
        connectedById: data.connectedById,
        lastSyncError: null,
      },
    });
  },

  async updateAccessToken(clientId: string, encryptedAccessToken: string, accessTokenExpiresAt: Date) {
    return prisma.gscConnection.update({ where: { clientId }, data: { encryptedAccessToken, accessTokenExpiresAt } });
  },

  async recordSyncSuccess(clientId: string) {
    return prisma.gscConnection.update({ where: { clientId }, data: { lastSyncedAt: new Date(), lastSyncError: null } });
  },

  async recordSyncError(clientId: string, error: string) {
    return prisma.gscConnection.update({ where: { clientId }, data: { lastSyncError: error.slice(0, 2000) } });
  },

  async disconnect(clientId: string) {
    return prisma.gscConnection.delete({ where: { clientId } });
  },
};
