// Service (pole/department) lookups.
import { prisma } from "../config/prisma.js";
import { serviceNameForType } from "../constants/serviceMapping.js";

type PrismaLike = { service: { findUnique: typeof prisma.service.findUnique } };

export const serviceService = {
  // Resolve the Service id for a contact-form serviceType within a company. Returns null for
  // "Other", an unmapped value, or a name that hasn't been seeded for the company — the caller
  // then leaves the lead/client unassigned (ADMIN triage) rather than failing.
  async resolveServiceIdForType(
    serviceType: string,
    companyId: string,
    client: PrismaLike = prisma
  ): Promise<string | null> {
    const name = serviceNameForType(serviceType);
    if (!name) return null;
    const service = await client.service.findUnique({
      where: { companyId_name: { companyId, name } },
      select: { id: true },
    });
    return service?.id ?? null;
  },
};
