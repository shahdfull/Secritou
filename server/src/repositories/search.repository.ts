import { prismaRead as prisma } from "../config/prisma.js";

const SEARCH_LIMIT = 5;

export const searchRepository = {
  async search(companyId: string, query: string) {
    const contains = { contains: query, mode: "insensitive" as const };

    const [leads, clients, projects, tasks, freelancers, proposals, invoices, serviceRequests, approvals] = await Promise.all([
      prisma.lead.findMany({
        where: { companyId, OR: [{ name: contains }, { email: contains }] },
        select: { id: true, name: true, email: true },
        take: SEARCH_LIMIT,
      }),
      prisma.client.findMany({
        where: { companyId, OR: [{ name: contains }, { email: contains }] },
        select: { id: true, name: true, email: true },
        take: SEARCH_LIMIT,
      }),
      prisma.project.findMany({
        where: { companyId, name: contains },
        select: { id: true, name: true },
        take: SEARCH_LIMIT,
      }),
      prisma.task.findMany({
        where: { project: { companyId }, title: contains },
        select: { id: true, title: true },
        take: SEARCH_LIMIT,
      }),
      prisma.freelancerProfile.findMany({
        where: {
          user: { name: contains },
          missions: { some: { companyId } },
        },
        select: {
          id: true,
          user: { select: { id: true, name: true, email: true } },
        },
        take: SEARCH_LIMIT,
      }),
      prisma.proposal.findMany({
        where: { companyId, title: contains },
        select: { id: true, title: true, status: true, amount: true },
        take: SEARCH_LIMIT,
      }),
      prisma.invoice.findMany({
        where: { companyId, OR: [{ title: contains }, { number: contains }] },
        select: { id: true, title: true, number: true, status: true, amount: true },
        take: SEARCH_LIMIT,
      }),
      prisma.serviceRequest.findMany({
        where: { companyId, title: contains },
        select: { id: true, title: true, status: true },
        take: SEARCH_LIMIT,
      }),
      prisma.approval.findMany({
        where: { companyId, title: contains },
        select: { id: true, title: true, status: true },
        take: SEARCH_LIMIT,
      }),
    ]);

    return { leads, clients, projects, tasks, freelancers, proposals, invoices, serviceRequests, approvals };
  },
};
