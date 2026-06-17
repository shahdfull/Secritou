import { PrismaClient } from "@prisma/client";
import { prismaMetricsExtension } from "../observability/prisma.extension.js";

const baseWritePrisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

const baseReadPrisma = process.env.DATABASE_READ_URL
  ? new PrismaClient({
      datasourceUrl: process.env.DATABASE_READ_URL,
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    })
  : baseWritePrisma;

export const prisma = baseWritePrisma.$extends(prismaMetricsExtension);
export const prismaRead = baseReadPrisma.$extends(prismaMetricsExtension);

export type ExtendedPrismaClient = typeof prisma;
