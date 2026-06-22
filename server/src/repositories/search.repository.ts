import { prismaRead as prisma } from "../config/prisma.js";
import type { Role } from "@prisma/client";

const SEARCH_LIMIT = 5;

export type SearchActor = {
  role: Role;
  companyId: string | null;
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
  return {
    leads: [], clients: [], projects: [], tasks: [], freelancers: [],
    proposals: [], invoices: [], serviceRequests: [], approvals: [],
  };
}

export const searchRepository = {
  // Role-scoped global search. Every category is filtered by what the actor is allowed to see —
  // this endpoint must never become a backdoor around the per-module access rules.
  async search(actor: SearchActor, query: string): Promise<SearchResults> {
    const contains = { contains: query, mode: "insensitive" as const };

    if (actor.role === "CLIENT") {
      return this.searchForClient(actor, contains);
    }
    if (actor.role === "FREELANCER") {
      return this.searchForFreelancer(actor, contains);
    }
    // ADMIN and MANAGER both require a company. MANAGER is additionally scoped to its service.
    if (!actor.companyId) return emptyResults();
    return this.searchForStaff(actor, contains);
  },

  // CLIENT: only their own entities. Never leads, other clients, freelancers, or the pipeline.
  async searchForClient(
    actor: SearchActor,
    contains: { contains: string; mode: "insensitive" }
  ): Promise<SearchResults> {
    if (!actor.clientId) return emptyResults();
    const clientId = actor.clientId;

    const [projects, proposals, invoices, serviceRequests, approvals] = await Promise.all([
      prisma.project.findMany({
        where: { clientId, name: contains },
        select: { id: true, name: true },
        take: SEARCH_LIMIT,
      }),
      prisma.proposal.findMany({
        where: { clientId, title: contains },
        select: { id: true, title: true, status: true, amount: true },
        take: SEARCH_LIMIT,
      }),
      prisma.invoice.findMany({
        where: { clientId, OR: [{ title: contains }, { number: contains }] },
        select: { id: true, title: true, number: true, status: true, amount: true },
        take: SEARCH_LIMIT,
      }),
      prisma.serviceRequest.findMany({
        where: { clientId, title: contains },
        select: { id: true, title: true, status: true },
        take: SEARCH_LIMIT,
      }),
      prisma.approval.findMany({
        where: { clientId, title: contains },
        select: { id: true, title: true, status: true },
        take: SEARCH_LIMIT,
      }),
    ]);

    return { ...emptyResults(), projects, proposals, invoices, serviceRequests, approvals };
  },

  // FREELANCER: only projects where they have an assigned task, and tasks assigned to them.
  async searchForFreelancer(
    actor: SearchActor,
    contains: { contains: string; mode: "insensitive" }
  ): Promise<SearchResults> {
    const [projects, tasks] = await Promise.all([
      prisma.project.findMany({
        where: { name: contains, tasks: { some: { assigneeId: actor.userId } } },
        select: { id: true, name: true },
        take: SEARCH_LIMIT,
      }),
      prisma.task.findMany({
        where: { title: contains, assigneeId: actor.userId },
        select: { id: true, title: true },
        take: SEARCH_LIMIT,
      }),
    ]);

    return { ...emptyResults(), projects, tasks };
  },

  // ADMIN: whole company. MANAGER: same categories but scoped to their service (pole), and no
  // access to the freelancer marketplace. A MANAGER with no service sees nothing service-bound.
  async searchForStaff(
    actor: SearchActor,
    contains: { contains: string; mode: "insensitive" }
  ): Promise<SearchResults> {
    const companyId = actor.companyId!;
    const isManager = actor.role === "MANAGER";
    // For a manager, restrict service-bound entities to their pole. "__none__" guarantees no
    // match when the manager has no service, rather than leaking the whole company.
    const svc = isManager ? (actor.serviceId ?? "__none__") : undefined;
    // Service (pole) is carried by Lead directly and by Project (the delivery unit). A client is
    // NOT tagged with a single service — a manager sees a client only if it has a project in the
    // manager's pole (derived). Proposals/invoices/service-requests are scoped via their project.
    const leadServiceFilter = svc ? { serviceId: svc } : {};
    const projectServiceFilter = svc ? { serviceId: svc } : {};
    const clientServiceFilter = svc ? { projects: { some: { serviceId: svc } } } : {};
    const viaProject = svc ? { project: { is: { serviceId: svc } } } : {};

    const [leads, clients, projects, tasks, freelancers, proposals, invoices, serviceRequests, approvals] =
      await Promise.all([
        prisma.lead.findMany({
          where: { companyId, ...leadServiceFilter, OR: [{ name: contains }, { email: contains }] },
          select: { id: true, name: true, email: true },
          take: SEARCH_LIMIT,
        }),
        prisma.client.findMany({
          where: { companyId, ...clientServiceFilter, OR: [{ name: contains }, { email: contains }] },
          select: { id: true, name: true, email: true },
          take: SEARCH_LIMIT,
        }),
        prisma.project.findMany({
          where: { companyId, ...projectServiceFilter, name: contains },
          select: { id: true, name: true },
          take: SEARCH_LIMIT,
        }),
        prisma.task.findMany({
          where: { title: contains, project: { is: { companyId, ...projectServiceFilter } } },
          select: { id: true, title: true },
          take: SEARCH_LIMIT,
        }),
        // Freelancer directory is internal: ADMIN only, never MANAGER. Scoped to the company
        // via the freelancer's user account (missions no longer link freelancers to a company).
        isManager
          ? Promise.resolve([])
          : prisma.freelancerProfile.findMany({
              where: { user: { is: { name: contains, companyId } } },
              select: { id: true, user: { select: { id: true, name: true, email: true } } },
              take: SEARCH_LIMIT,
            }),
        prisma.proposal.findMany({
          where: { companyId, ...viaProject, title: contains },
          select: { id: true, title: true, status: true, amount: true },
          take: SEARCH_LIMIT,
        }),
        prisma.invoice.findMany({
          where: { companyId, ...viaProject, OR: [{ title: contains }, { number: contains }] },
          select: { id: true, title: true, number: true, status: true, amount: true },
          take: SEARCH_LIMIT,
        }),
        prisma.serviceRequest.findMany({
          where: { companyId, ...(svc ? { client: { is: { projects: { some: { serviceId: svc } } } } } : {}), title: contains },
          select: { id: true, title: true, status: true },
          take: SEARCH_LIMIT,
        }),
        prisma.approval.findMany({
          where: { companyId, ...(svc ? { client: { is: { projects: { some: { serviceId: svc } } } } } : {}), title: contains },
          select: { id: true, title: true, status: true },
          take: SEARCH_LIMIT,
        }),
      ]);

    return { leads, clients, projects, tasks, freelancers, proposals, invoices, serviceRequests, approvals };
  },
};
