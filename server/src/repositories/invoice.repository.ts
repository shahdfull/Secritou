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

// SENT/PARTIAL invoices only flip to OVERDUE in the DB once a day (see
// maintenance.processor.ts markOverdueInvoices). The invoice list badge
// displays an "effective" overdue status computed live from dueDate so it
// doesn't wait for that job — filtering by OVERDUE must match the same set,
// otherwise an invoice shown as "En retard" can vanish when the user filters
// on that exact status. Returned as a standalone filter (not assigned to
// where.OR directly) so callers can combine it with a search OR-clause
// without one silently overwriting the other.
function statusFilterClause(status?: InvoiceStatus): Prisma.InvoiceWhereInput | undefined {
  if (!status) return undefined;
  if (status === "OVERDUE") {
    return {
      OR: [
        { status: "OVERDUE" },
        { status: { in: ["SENT", "PARTIAL"] }, dueDate: { lt: new Date() } },
      ],
    };
  }
  return { status };
}

export const invoiceRepository = {
  async findAll(
    options: ListQueryOptions & { clientId?: string; status?: InvoiceStatus; search?: string }
  ): Promise<PaginatedResult<Invoice & { client: { name: string } }>> {
    const filters: Prisma.InvoiceWhereInput[] = [{ deletedAt: null, client: { deletedAt: null } }];
    if (options.clientId) filters.push({ clientId: options.clientId });
    const statusClause = statusFilterClause(options.status);
    if (statusClause) filters.push(statusClause);
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

  async findAllByClientId(
    clientId: string,
    options: { page: number; pageSize: number; status?: InvoiceStatus }
  ): Promise<PaginatedResult<Invoice & { client: { name: string } }>> {
    const filters: Prisma.InvoiceWhereInput[] = [{ clientId, deletedAt: null }];
    const statusClause = statusFilterClause(options.status);
    if (statusClause) filters.push(statusClause);
    const where: Prisma.InvoiceWhereInput = { AND: filters };
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
    const statusClause = statusFilterClause(options.status);
    if (statusClause) filters.push(statusClause);
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

  async update(id: string, data: Prisma.InvoiceUpdateInput) {
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
    const filters: Prisma.InvoiceWhereInput[] = [{ deletedAt: { not: null } }];
    if (options.clientId) filters.push({ clientId: options.clientId });
    const statusClause = statusFilterClause(options.status);
    if (statusClause) filters.push(statusClause);
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
