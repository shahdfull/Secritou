import { prismaRead as prisma } from "../config/prisma.js";
import type { Role } from "@prisma/client";

const SEARCH_LIMIT = 5;

export type SearchActor = {
  role: Role;
  clientId: string | null;
  userId: string;
  serviceId?: string | null;
};

type SearchResults = {
  leads: unknown[];
  clients: unknown[];
  projects: unknown[];
  tasks: unknown[];
  freelancers: unknown[];
  proposals: unknown[];
  invoices: unknown[];
  serviceRequests: unknown[];
  approvals: unknown[];
};

function emptyResults(): SearchResults {
  return { leads: [], clients: [], projects: [], tasks: [], freelancers: [], proposals: [], invoices: [], serviceRequests: [], approvals: [] };
}

export const searchRepository = {
  // Role-scoped global search. Every category is filtered by what the actor is allowed to see :
  // this endpoint must never become a backdoor around the per-module access rules.
  async search(actor: SearchActor, query: string): Promise<SearchResults> {
    const contains = { contains: query, mode: "insensitive" as const };
    if (actor.role === "CLIENT") return this.searchForClient(actor, contains);
    if (actor.role === "FREELANCER") return this.searchForFreelancer(actor, contains);
    return this.searchForStaff(actor, contains);
  },

  // CLIENT: only their own entities.
  async searchForClient(actor: SearchActor, contains: { contains: string; mode: "insensitive" }): Promise<SearchResults> {
    if (!actor.clientId) return emptyResults();
    const clientId = actor.clientId;

    const [projects, proposals, invoices, serviceRequests, approvals] = await Promise.all([
      prisma.project.findMany({ where: { clientId, name: contains }, select: { id: true, name: true }, take: SEARCH_LIMIT }),
      prisma.proposal.findMany({ where: { clientId, title: contains }, select: { id: true, title: true, status: true, amount: true }, take: SEARCH_LIMIT }),
      prisma.invoice.findMany({ where: { clientId, OR: [{ title: contains }, { number: contains }] }, select: { id: true, title: true, number: true, status: true, amount: true }, take: SEARCH_LIMIT }),
      prisma.serviceRequest.findMany({ where: { clientId, title: contains }, select: { id: true, title: true, status: true }, take: SEARCH_LIMIT }),
      prisma.approval.findMany({ where: { clientId, title: contains }, select: { id: true, title: true, status: true }, take: SEARCH_LIMIT }),
    ]);

    return { ...emptyResults(), projects, proposals, invoices, serviceRequests, approvals };
  },

  // FREELANCER: only projects where they have an assigned task, and tasks assigned to them.
  async searchForFreelancer(actor: SearchActor, contains: { contains: string; mode: "insensitive" }): Promise<SearchResults> {
    const [projects, tasks] = await Promise.all([
      prisma.project.findMany({ where: { name: contains, tasks: { some: { assigneeId: actor.userId } } }, select: { id: true, name: true }, take: SEARCH_LIMIT }),
      prisma.task.findMany({ where: { title: contains, assigneeId: actor.userId }, select: { id: true, title: true }, take: SEARCH_LIMIT }),
    ]);
    return { ...emptyResults(), projects, tasks };
  },

  // ADMIN: everything. MANAGER: scoped to their service (pole), no freelancer directory.
  async searchForStaff(actor: SearchActor, contains: { contains: string; mode: "insensitive" }): Promise<SearchResults> {
    const isManager = actor.role === "MANAGER";
    // "__none__" guarantees no match when the manager has no service, rather than leaking all.
    const svc = isManager ? (actor.serviceId ?? "__none__") : undefined;
    const leadServiceFilter = svc ? { serviceId: svc } : {};
    const projectServiceFilter = svc ? { serviceId: svc } : {};
    const clientServiceFilter = svc ? { projects: { some: { serviceId: svc } } } : {};
    const viaProject = svc ? { project: { is: { serviceId: svc } } } : {};

    const [leads, clients, projects, tasks, freelancers, proposals, invoices, serviceRequests, approvals] = await Promise.all([
      prisma.lead.findMany({ where: { ...leadServiceFilter, OR: [{ name: contains }, { email: contains }] }, select: { id: true, name: true, email: true }, take: SEARCH_LIMIT }),
      prisma.client.findMany({ where: { ...clientServiceFilter, OR: [{ name: contains }, { email: contains }] }, select: { id: true, name: true, email: true }, take: SEARCH_LIMIT }),
      prisma.project.findMany({ where: { ...projectServiceFilter, name: contains }, select: { id: true, name: true }, take: SEARCH_LIMIT }),
      prisma.task.findMany({ where: { title: contains, project: { is: projectServiceFilter } }, select: { id: true, title: true }, take: SEARCH_LIMIT }),
      // Freelancer directory is internal: ADMIN only, never MANAGER.
      isManager
        ? Promise.resolve([])
        : prisma.freelancerProfile.findMany({ where: { user: { is: { name: contains } } }, select: { id: true, user: { select: { id: true, name: true, email: true } } }, take: SEARCH_LIMIT }),
      prisma.proposal.findMany({ where: { ...viaProject, title: contains }, select: { id: true, title: true, status: true, amount: true }, take: SEARCH_LIMIT }),
      prisma.invoice.findMany({ where: { ...viaProject, OR: [{ title: contains }, { number: contains }] }, select: { id: true, title: true, number: true, status: true, amount: true }, take: SEARCH_LIMIT }),
      prisma.serviceRequest.findMany({ where: { ...(svc ? { client: { is: { projects: { some: { serviceId: svc } } } } } : {}), title: contains }, select: { id: true, title: true, status: true }, take: SEARCH_LIMIT }),
      prisma.approval.findMany({ where: { ...(svc ? { client: { is: { projects: { some: { serviceId: svc } } } } } : {}), title: contains }, select: { id: true, title: true, status: true }, take: SEARCH_LIMIT }),
    ]);

    return { leads, clients, projects, tasks, freelancers, proposals, invoices, serviceRequests, approvals };
  },
};
