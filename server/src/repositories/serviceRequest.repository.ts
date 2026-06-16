import { prisma } from "../config/prisma.js";
import type { ServiceRequest } from "@prisma/client";

export const serviceRequestRepository = {
  async findAllByClientId(clientId: string): Promise<ServiceRequest[]> {
    return prisma.serviceRequest.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } });
  },

  async findAllByCompanyId(companyId: string): Promise<ServiceRequest[]> {
    return prisma.serviceRequest.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
  },

  async findById(id: string): Promise<ServiceRequest | null> {
    return prisma.serviceRequest.findUnique({ where: { id } });
  },

  async create(data: {
    title: string;
    description?: string;
    clientId: string;
    companyId: string;
  }): Promise<ServiceRequest> {
    return prisma.serviceRequest.create({ data });
  },

  async update(id: string, data: Partial<{
    title?: string;
    description?: string;
    status?: "NEW" | "IN_PROGRESS" | "DONE";
  }>): Promise<ServiceRequest> {
    return prisma.serviceRequest.update({ where: { id }, data });
  },

  async delete(id: string): Promise<ServiceRequest> {
    return prisma.serviceRequest.delete({ where: { id } });
  },
};
