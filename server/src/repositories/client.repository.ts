// Client Repository - Data access layer
import { prisma, prismaRead } from "../config/prisma.js";
import type { Client, Prisma } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";
import { buildOrderBy } from "../utils/listQuery.js";
import { projectBriefSelect } from "../utils/prismaSelects.js";

const SORTABLE_FIELDS = ["name", "email", "phone", "createdAt"];

type ClientListItem = Client & {
  _count: { projects: number };
};

type ClientDetail = Client & {
  projects: Array<{ id: string; name: string; status: string }>;
};

const clientListSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  serviceId: true,
  creditBalance: true,
  portalActivatedAt: true,
  archivedAt: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { projects: true } },
} as const;

const clientDetailSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  serviceId: true,
  creditBalance: true,
  portalActivatedAt: true,
  archivedAt: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  projects: { select: projectBriefSelect, orderBy: { createdAt: "desc" } },
  users: {
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    where: { role: "CLIENT" as const },
    take: 1,
  },
} as const;

export const clientRepository = {
  async findAll(
    options: ListQueryOptions & { includeArchived?: boolean; serviceId?: string | null }
  ): Promise<PaginatedResult<ClientListItem>> {
    const where: Record<string, unknown> = { deletedAt: null };
    if (!options.includeArchived) where.archivedAt = null;
    // MANAGER scope: a client is visible only if it has at least one project in the manager's service
    if (options.serviceId !== undefined) {
      where.projects = { some: { serviceId: options.serviceId ?? "__none__" } };
    }
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir, SORTABLE_FIELDS, "createdAt");

    const [data, total] = await Promise.all([
      prismaRead.client.findMany({ where, select: clientListSelect, orderBy, skip, take: options.pageSize }),
      prismaRead.client.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(id: string, serviceId?: string | null, includeArchived?: boolean): Promise<ClientDetail | null> {
    const where: Record<string, unknown> = { id, deletedAt: null };
    if (!includeArchived) where.archivedAt = null;
    if (serviceId !== undefined) {
      where.projects = { some: { serviceId: serviceId ?? "__none__" } };
    }
    return prismaRead.client.findFirst({ where, select: clientDetailSelect });
  },

  async create(data: {
    name: string;
    email?: string;
    phone?: string;
  }): Promise<Client> {
    return prisma.client.create({ data, select: clientListSelect });
  },

  async update(id: string, data: Prisma.ClientUncheckedUpdateInput): Promise<Client> {
    return prisma.client.update({ where: { id }, data, select: clientListSelect });
  },

  async countInvoices(id: string): Promise<number> {
    return prismaRead.invoice.count({ where: { clientId: id } });
  },

  async archive(id: string): Promise<Client> {
    return prisma.client.update({
      where: { id },
      data: { archivedAt: new Date() },
      select: clientListSelect,
    });
  },

  async delete(id: string): Promise<Client> {
    return prisma.client.update({ where: { id }, data: { deletedAt: new Date() }, select: clientListSelect });
  },

  async restore(id: string): Promise<Client> {
    return prisma.client.update({ where: { id }, data: { deletedAt: null }, select: clientListSelect });
  },

  async findDeleted(options: ListQueryOptions & { serviceId?: string | null }): Promise<PaginatedResult<ClientListItem>> {
    const where: Record<string, unknown> = { deletedAt: { not: null } };
    if (options.serviceId !== undefined) {
      where.projects = { some: { serviceId: options.serviceId ?? "__none__" } };
    }
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir, SORTABLE_FIELDS, "createdAt");

    const [data, total] = await Promise.all([
      prismaRead.client.findMany({ where, select: clientListSelect, orderBy, skip, take: options.pageSize }),
      prismaRead.client.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async getPortalActivatedAt(clientId: string): Promise<Date | null> {
    const client = await prismaRead.client.findUnique({ where: { id: clientId }, select: { portalActivatedAt: true } });
    return client?.portalActivatedAt ?? null;
  },
};
