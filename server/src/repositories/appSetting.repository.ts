import { prisma, prismaRead } from "../config/prisma.js";
import { Prisma } from "@prisma/client";

export function isMissingAppSettingTableError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021";
}

export const appSettingRepository = {
  async get(key: string): Promise<string | null> {
    try {
      const row = await prismaRead.appSetting.findUnique({ where: { key }, select: { value: true } });
      return row?.value ?? null;
    } catch (err) {
      // If RG-020's table is not yet deployed in a dev database, the caller must
      // still get the default timeout instead of a 500 on /users/me.
      if (isMissingAppSettingTableError(err)) {
        return null;
      }
      throw err;
    }
  },

  async set(key: string, value: string, updatedByUserId: string): Promise<void> {
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value, updatedByUserId },
      update: { value, updatedByUserId },
    });
  },
};
