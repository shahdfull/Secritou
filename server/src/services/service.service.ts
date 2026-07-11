// Service (pole/department) lookups.
import { prisma, prismaRead } from "../config/prisma.js";
import { serviceNameForType } from "../constants/serviceMapping.js";

type PrismaLike = { service: { findUnique: typeof prisma.service.findUnique } };

export const serviceService = {
  // Resolve the Service id for a contact-form serviceType. Returns null for "Other", an unmapped
  // value, or a name that hasn't been seeded : the caller leaves the lead unassigned (ADMIN triage).
  async resolveServiceIdForType(serviceType: string, client: PrismaLike = prisma): Promise<string | null> {
    const name = serviceNameForType(serviceType);
    if (!name) return null;
    const service = await client.service.findUnique({ where: { name }, select: { id: true } });
    return service?.id ?? null;
  },

  async listAll() {
    return prismaRead.service.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  },
};
