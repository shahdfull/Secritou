import { prisma, prismaRead } from "../config/prisma.js";
import { COMPANY_ID } from "../config/constants.js";
import type { Invoice, InvoiceStatus, Prisma } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

export const invoiceRepository = {
  // ─── READ REPLICA ────────────────────────────────────────────────────────────

  async findAll(
    options: ListQueryOptions & {
      companyId: string;
      clientId?: string;
      status?: InvoiceStatus;
      search?: string;
    }
  ): Promise<PaginatedResult<Invoice & { client: { name: string } }>> {
    const where: Prisma.InvoiceWhereInput = { companyId: options.companyId };
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
    const where: Prisma.InvoiceWhereInput = { clientId };
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

  async findById(id: string, companyId: string = COMPANY_ID) {
    return prismaRead.invoice.findUnique({
      where: { id, companyId },
      include: {
        client: true,
        items: true,
        payments: { orderBy: { paidAt: "desc" } },
        reminders: { orderBy: { sentAt: "desc" } },
      },
    });
  },

  // ─── PRIMARY ──────────────────────────────────────────────────────────────────

  async create(data: {
    number: string;
    title: string;
    description?: string;
    amount: number;
    currency?: string;
    amountPaid?: number;
    status?: InvoiceStatus;
    dueDate?: Date;
    pdfUrl?: string;
    clientId: string;
    companyId: string;
    projectId?: string;
    proposalId?: string;
  }) {
    return prisma.invoice.create({ data });
  },

  async update(
    id: string,
    companyId: string = COMPANY_ID,
    data: Partial<{
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
    }>
  ) {
    return prisma.invoice.update({ where: { id, companyId }, data });
  },

  async delete(id: string, companyId: string = COMPANY_ID) {
    return prisma.invoice.delete({ where: { id, companyId } });
  },

  async addItem(
    invoiceId: string,
    companyId: string = COMPANY_ID,
    data: { description: string; quantity: number; unitPrice: number; total: number }
  ) {
    // Ownership check: ensures the invoice belongs to the company before writing
    await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId, companyId },
      select: { id: true },
    });
    return prisma.invoiceItem.create({ data: { ...data, invoiceId } });
  },

  async updateItem(
    id: string,
    companyId: string = COMPANY_ID,
    data: { description?: string; quantity?: number; unitPrice?: number; total?: number }
  ) {
    return prisma.invoiceItem.update({
      where: { id, invoice: { companyId } },
      data,
    });
  },

  async deleteItem(id: string, companyId: string = COMPANY_ID) {
    return prisma.invoiceItem.delete({
      where: { id, invoice: { companyId } },
    });
  },

  async addPayment(
    invoiceId: string,
    companyId: string = COMPANY_ID,
    data: { amount: number; method?: string; reference?: string; paidAt?: Date },
    recordedById?: string
  ) {
    // Ownership check: ensures the invoice belongs to the company before writing
    await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId, companyId },
      select: { id: true },
    });
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

  async addReminder(
    invoiceId: string,
    companyId: string = COMPANY_ID,
    data: { type: string; sentAt?: Date }
  ) {
    await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId, companyId },
      select: { id: true },
    });
    return prisma.invoiceReminder.create({ data: { ...data, invoiceId } });
  },
};
