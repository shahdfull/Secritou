// Client Repository - Data access layer
import { prismaRead as prisma } from "../config/prisma.js";
import type { Client } from "@prisma/client";
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
  companyId: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { projects: true } },
} as const;

const clientDetailSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  companyId: true,
  archivedAt: true,
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
    companyId: string,
    options: ListQueryOptions & { includeArchived?: boolean }
  ): Promise<PaginatedResult<ClientListItem>> {
    // Archived clients are hidden by default; pass includeArchived to surface them.
    const where: { companyId: string; archivedAt?: null } = { companyId };
    if (!options.includeArchived) where.archivedAt = null;
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir, SORTABLE_FIELDS, "createdAt");

    const [data, total] = await Promise.all([
      prisma.client.findMany({
        where,
        select: clientListSelect,
        orderBy,
        skip,
        take: options.pageSize,
      }),
      prisma.client.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(id: string, companyId: string): Promise<ClientDetail | null> {
    return prisma.client.findFirst({
      where: { id, companyId },
      select: clientDetailSelect,
    });
  },

  async create(data: {
    name: string;
    email?: string;
    phone?: string;
    companyId: string;
  }): Promise<Client> {
    return prisma.client.create({
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyId: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async update(
    id: string,
    companyId: string,
    data: Partial<{
      name?: string;
      email?: string;
      phone?: string;
    }>
  ): Promise<Client> {
    return prisma.client.update({
      where: { id, companyId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyId: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async countInvoices(id: string, companyId: string): Promise<number> {
    return prisma.invoice.count({ where: { clientId: id, companyId } });
  },

  async archive(id: string, companyId: string): Promise<Client> {
    return prisma.client.update({
      where: { id, companyId },
      data: { archivedAt: new Date() },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyId: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async delete(id: string, companyId: string): Promise<Client> {
    return prisma.client.delete({
      where: { id, companyId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyId: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },
};
