import { prisma, prismaRead } from "../config/prisma.js";
import type { Invoice, InvoiceStatus, Prisma } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

interface InvoiceCreateData {
  number: string;
  title: string;
  description?: string;
  amount: number;
  amountHT?: number;
  tvaRate?: number;
  tvaAmount?: number;
  currency?: string;
  amountPaid?: number;
  status?: InvoiceStatus;
  dueDate?: Date;
  pdfUrl?: string;
  clientId: string;
  projectId?: string;
  proposalId?: string;
}

export const invoiceRepository = {
  async findAll(
    options: ListQueryOptions & { clientId?: string; status?: InvoiceStatus; search?: string }
  ): Promise<PaginatedResult<Invoice & { client: { name: string } }>> {
    const where: Prisma.InvoiceWhereInput = { deletedAt: null, client: { deletedAt: null } };
    if (options.clientId) where.clientId = options.clientId;
    if (options.status) where.status = options.status;
    if (options.search) {
      where.OR = [
        { title: { contains: options.search, mode: "insensitive" } },
        { number: { contains: options.search, mode: "insensitive" } },
      ];
    }

    const skip = (options.page - 1) * options.pageSize;
    const [data, total] = await Promise.all([
      prismaRead.invoice.findMany({
        where,
        skip,
        take: options.pageSize,
        orderBy: { [options.orderBy || "createdAt"]: options.orderDir || "desc" },
        include: { client: { select: { name: true } } },
      }),
      prismaRead.invoice.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findAllByClientId(
    clientId: string,
    options: { page: number; pageSize: number; status?: InvoiceStatus }
  ): Promise<PaginatedResult<Invoice & { client: { name: string } }>> {
    const where: Prisma.InvoiceWhereInput = { clientId, deletedAt: null };
    if (options.status) where.status = options.status;
    const skip = (options.page - 1) * options.pageSize;
    const [data, total] = await Promise.all([
      prismaRead.invoice.findMany({
        where,
        skip,
        take: options.pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { name: true } },
          items: true,
          payments: { orderBy: { paidAt: "desc" } },
        },
      }),
      prismaRead.invoice.count({ where }),
    ]);
    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findAllByServiceId(
    serviceId: string,
    options: ListQueryOptions & { status?: InvoiceStatus; search?: string }
  ): Promise<PaginatedResult<Invoice & { client: { name: string } }>> {
    // Invoices without a project are service-neutral (the create flow allows
    // them): show them to every manager rather than to no one, so the list
    // stays consistent with the global dashboard KPIs.
    const scopeFilter: Prisma.InvoiceWhereInput = {
      deletedAt: null,
      client: { deletedAt: null },
      OR: [{ project: { serviceId, deletedAt: null } }, { projectId: null }],
    };
    const filters: Prisma.InvoiceWhereInput[] = [scopeFilter];
    if (options.status) filters.push({ status: options.status });
    if (options.search) {
      filters.push({
        OR: [
          { title: { contains: options.search, mode: "insensitive" } },
          { number: { contains: options.search, mode: "insensitive" } },
        ],
      });
    }
    const where: Prisma.InvoiceWhereInput = { AND: filters };
    const skip = (options.page - 1) * options.pageSize;
    const [data, total] = await Promise.all([
      prismaRead.invoice.findMany({
        where,
        skip,
        take: options.pageSize,
        orderBy: { [options.orderBy || "createdAt"]: options.orderDir || "desc" },
        include: { client: { select: { name: true } } },
      }),
      prismaRead.invoice.count({ where }),
    ]);
    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(id: string) {
    return prismaRead.invoice.findFirst({
      where: { id, deletedAt: null, client: { deletedAt: null } },
      include: {
        client: true,
        items: true,
        payments: { orderBy: { paidAt: "desc" } },
        reminders: { orderBy: { sentAt: "desc" } },
      },
    });
  },

  async create(data: InvoiceCreateData) {
    return prisma.invoice.create({ data });
  },

  async update(id: string, data: Partial<{
    number: string;
    title: string;
    description: string;
    amount: number;
    currency: string;
    amountPaid: number;
    status: InvoiceStatus;
    dueDate: Date;
    sentAt: Date;
    paidAt: Date;
    pdfUrl: string;
    reminderPaused: boolean;
  }>) {
    return prisma.invoice.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  async restore(id: string) {
    return prisma.invoice.update({ where: { id }, data: { deletedAt: null } });
  },

  async findDeleted(
    options: ListQueryOptions & { clientId?: string; status?: InvoiceStatus; search?: string }
  ): Promise<PaginatedResult<Invoice & { client: { name: string } }>> {
    const where: Prisma.InvoiceWhereInput = { deletedAt: { not: null } };
    if (options.clientId) where.clientId = options.clientId;
    if (options.status) where.status = options.status;
    if (options.search) {
      where.OR = [
        { title: { contains: options.search, mode: "insensitive" } },
        { number: { contains: options.search, mode: "insensitive" } },
      ];
    }
    const skip = (options.page - 1) * options.pageSize;
    const [data, total] = await Promise.all([
      prismaRead.invoice.findMany({
        where,
        skip,
        take: options.pageSize,
        orderBy: { [options.orderBy || "createdAt"]: options.orderDir || "desc" },
        include: { client: { select: { name: true } } },
      }),
      prismaRead.invoice.count({ where }),
    ]);
    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async addItem(invoiceId: string, data: { description: string; quantity: number; unitPrice: number; total: number }) {
    await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { id: true } });
    return prisma.invoiceItem.create({ data: { ...data, invoiceId } });
  },

  async updateItem(id: string, data: { description?: string; quantity?: number; unitPrice?: number; total?: number }) {
    return prisma.invoiceItem.update({ where: { id }, data });
  },

  async deleteItem(id: string) {
    return prisma.invoiceItem.delete({ where: { id } });
  },

  async addPayment(
    invoiceId: string,
    data: { amount: number; method?: string; reference?: string; paidAt?: Date },
    recordedById?: string
  ) {
    await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { id: true } });
    return prisma.payment.create({
      data: {
        invoiceId,
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        paidAt: data.paidAt ?? new Date(),
        recordedById,
      },
    });
  },

  async addReminder(invoiceId: string, data: { type: string; sentAt?: Date }) {
    await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { id: true } });
    return prisma.invoiceReminder.create({ data: { ...data, invoiceId } });
  },
};
