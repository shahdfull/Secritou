import { invoiceRepository } from "../repositories/invoice.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueEmail, enqueueNotifications } from "../jobs/queues.js";
import { invoiceSentTemplate, invoiceReminderTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import type { InvoiceStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";
import { clientSuccessService } from "./clientSuccess.service.js";
import { creditNoteService } from "./creditNote.service.js";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Line items may only be added/changed/removed while the invoice is a DRAFT.
 */
function assertInvoiceDraft(status: InvoiceStatus) {
  if (status !== "DRAFT") throw new HttpError(409, "Cannot modify items on a non-draft invoice", "INVOICE_NOT_DRAFT");
}

/**
 * Generates a per-month sequential invoice number (INV-YYYYMM-NNNN).
 * The `number @unique` constraint is the real guarantee against races.
 */
async function createInvoiceWithGeneratedNumber(data: Omit<Parameters<typeof invoiceRepository.create>[0], "number">) {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  const MAX_ATTEMPTS = 5;
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const count = await prisma.invoice.count({ where: { number: { startsWith: prefix } } });
    const number = `${prefix}-${String(count + 1 + attempt).padStart(4, "0")}`;
    try {
      return await invoiceRepository.create({ ...data, number });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw new HttpError(409, "Could not allocate a unique invoice number, please retry", "INVOICE_NUMBER_CONFLICT", lastError);
}

async function recomputeInvoiceAmount(tx: TxClient, invoiceId: string) {
  const agg = await tx.invoiceItem.aggregate({ where: { invoiceId }, _sum: { total: true } });
  const amount = Number(agg._sum.total ?? 0);
  await tx.invoice.update({ where: { id: invoiceId }, data: { amount } });
}

export const invoiceService = {
  async getAllByClientId(clientId: string, options: { page: number; pageSize: number; status?: InvoiceStatus }) {
    return invoiceRepository.findAllByClientId(clientId, options);
  },

  async getAllByServiceId(serviceId: string, options: ListQueryOptions & { status?: InvoiceStatus; search?: string }) {
    return invoiceRepository.findAllByServiceId(serviceId, options);
  },

  async getAll(options: ListQueryOptions & { clientId?: string; status?: InvoiceStatus; search?: string }) {
    return invoiceRepository.findAll(options);
  },

  async getById(id: string) {
    return invoiceRepository.findById(id);
  },

  async create(data: { number: string; title: string; description?: string; amount: number; currency?: string; dueDate?: Date; pdfUrl?: string; clientId: string; projectId?: string; proposalId?: string }) {
    return invoiceRepository.create(data);
  },

  async update(id: string, data: Partial<{ number: string; title: string; description: string; amount: number; currency: string; dueDate: Date; pdfUrl: string }>) {
    if (data.amount !== undefined) {
      const itemCount = await prisma.invoiceItem.count({ where: { invoiceId: id } });
      if (itemCount > 0) throw new HttpError(409, "This invoice's amount is derived from its line items and cannot be edited directly", "INVOICE_AMOUNT_DERIVED");
    }
    return invoiceRepository.update(id, data);
  },

  async delete(id: string) {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw new HttpError(404, "Invoice not found");
    if (invoice.status !== "DRAFT") throw new HttpError(409, "Only draft invoices can be deleted; cancel the invoice instead", "INVOICE_NOT_DRAFT");
    return invoiceRepository.delete(id);
  },

  async cancel(id: string) {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw new HttpError(404, "Invoice not found");
    if (invoice.status === "PAID" || invoice.status === "CANCELLED") throw new HttpError(409, `Cannot cancel a ${invoice.status} invoice`, "INVOICE_NOT_CANCELLABLE");
    return invoiceRepository.update(id, { status: "CANCELLED" });
  },

  async send(id: string) {
    const invoice = await invoiceRepository.findById(id);
    const updated = await invoiceRepository.update(id, { status: "SENT", sentAt: new Date() });

    if (invoice) {
      const clientUsers = await userRepository.findByClientId(invoice.clientId);
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("fr-FR") : ":";
      const invoiceUrl = `${env.FRONTEND_URL}/client/invoices`;
      void Promise.all([
        ...clientUsers.map((user) => {
          const { subject, html } = invoiceSentTemplate(user.name ?? invoice.clientId, invoice.number, Number(invoice.amount), invoice.currency ?? "TND", dueDate, invoiceUrl);
          return enqueueEmail({ to: user.email, subject, html });
        }),
        enqueueNotifications(clientUsers.map((user) => ({
          userId: user.id,
          title: "Nouvelle facture",
          message: `La facture ${invoice.number} de ${Number(invoice.amount).toFixed(2)} ${invoice.currency ?? "TND"} est disponible.`,
          type: "INVOICE_SENT" as const,
          entityId: id,
          link: invoiceUrl,
        }))),
      ]);
    }

    return updated;
  },

  async addPayment(id: string, data: { amount: number; method?: string; reference?: string; paidAt?: Date }, recordedById?: string) {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id }, select: { id: true, clientId: true, amount: true, amountPaid: true, status: true, currency: true } });
      if (!invoice) throw new Error("Invoice not found");

      const tenSecondsAgo = new Date(Date.now() - 10_000);
      const duplicate = await tx.payment.findFirst({ where: { invoiceId: id, amount: data.amount, recordedById: recordedById ?? null, createdAt: { gte: tenSecondsAgo } }, orderBy: { createdAt: "desc" } });
      if (duplicate) return { payment: duplicate, creditNote: null, overpaidBy: 0, clientId: invoice.clientId, deduplicated: true };

      const payment = await tx.payment.create({ data: { invoiceId: id, amount: data.amount, method: data.method, reference: data.reference, recordedById, paidAt: data.paidAt ?? new Date() } });

      const rawAmountPaid = Number(invoice.amountPaid) + data.amount;
      const invoiceAmount = Number(invoice.amount);
      const newAmountPaid = Math.min(rawAmountPaid, invoiceAmount);
      const overpaidBy = rawAmountPaid - invoiceAmount;

      const newStatus: InvoiceStatus = newAmountPaid >= invoiceAmount ? "PAID" : newAmountPaid > 0 ? "PARTIAL" : invoice.status as InvoiceStatus;

      await tx.invoice.update({ where: { id }, data: { amountPaid: newAmountPaid, status: newStatus, paidAt: newStatus === "PAID" ? new Date() : undefined } });

      let creditNote = null;
      if (overpaidBy > 0) {
        creditNote = await creditNoteService.createCreditNoteTx(tx, { invoiceId: invoice.id, clientId: invoice.clientId, amount: overpaidBy, reason: `Overpayment on invoice (paid ${rawAmountPaid.toFixed(2)} vs billed ${invoiceAmount.toFixed(2)} ${invoice.currency ?? "TND"})` });
      }

      return { payment, creditNote, overpaidBy, clientId: invoice.clientId, deduplicated: false };
    });

    if (result.deduplicated) return result;

    const invoiceMeta = await invoiceRepository.findById(id);
    if (invoiceMeta) {
      const admins = await userRepository.findAdmins();
      await enqueueNotifications(admins.map((admin) => ({ userId: admin.id, title: "Paiement reçu", message: `Un paiement de ${Number(data.amount).toFixed(2)} ${invoiceMeta.currency ?? "TND"} a été enregistré pour la facture ${invoiceMeta.number}.` })));

      if (result.creditNote) {
        const clientUsers = await userRepository.findByClientId(invoiceMeta.clientId);
        await enqueueNotifications(clientUsers.map((user) => ({ userId: user.id, title: "Avoir disponible", message: `Un avoir de ${result.overpaidBy.toFixed(2)} ${invoiceMeta.currency ?? "TND"} a été crédité sur votre compte suite à un trop-perçu sur la facture ${invoiceMeta.number}.` })));
      }

      void clientSuccessService.recalcAndPersist(invoiceMeta.clientId);
    }

    return result;
  },

  async addReminder(id: string, type: string) {
    const invoice = await invoiceRepository.findById(id);
    const reminder = await invoiceRepository.addReminder(id, { type, sentAt: new Date() });

    if (invoice) {
      const clientUsers = await userRepository.findByClientId(invoice.clientId);
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("fr-FR") : ":";
      const now = new Date();
      const daysOverdue = invoice.dueDate ? Math.max(0, Math.floor((now.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 0;
      const invoiceUrl = `${env.FRONTEND_URL}/client/invoices`;
      for (const user of clientUsers) {
        const { subject, html } = invoiceReminderTemplate(user.name ?? invoice.clientId, invoice.number, Number(invoice.amount), invoice.currency ?? "TND", dueDate, daysOverdue, invoiceUrl);
        void enqueueEmail({ to: user.email, subject, html });
      }
    }

    return reminder;
  },

  async addItem(invoiceId: string, data: { description: string; quantity: number; unitPrice: number }) {
    const total = data.quantity * data.unitPrice;
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { status: true } });
      assertInvoiceDraft(invoice.status);
      const item = await tx.invoiceItem.create({ data: { ...data, total, invoiceId } });
      await recomputeInvoiceAmount(tx, invoiceId);
      return item;
    });
  },

  async updateItem(id: string, data: { description?: string; quantity?: number; unitPrice?: number }) {
    return prisma.$transaction(async (tx) => {
      const invoiceItem = await tx.invoiceItem.findUnique({ where: { id }, include: { invoice: { select: { status: true } } } });
      if (!invoiceItem) throw new Error("Item not found");
      assertInvoiceDraft(invoiceItem.invoice.status);
      const updatedQuantity = data.quantity ?? invoiceItem.quantity;
      const updatedUnitPrice = data.unitPrice ?? Number(invoiceItem.unitPrice);
      const total = updatedQuantity * updatedUnitPrice;
      const item = await tx.invoiceItem.update({ where: { id }, data: { ...data, total } });
      await recomputeInvoiceAmount(tx, invoiceItem.invoiceId);
      return item;
    });
  },

  async deleteItem(id: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.invoiceItem.findUnique({ where: { id }, include: { invoice: { select: { status: true } } } });
      if (!existing) throw new HttpError(404, "Item not found");
      assertInvoiceDraft(existing.invoice.status);
      const item = await tx.invoiceItem.delete({ where: { id } });
      await recomputeInvoiceAmount(tx, item.invoiceId);
      return item;
    });
  },

  async createFromProposal(proposalId: string) {
    const proposal = await prisma.proposal.findUnique({ where: { id: proposalId }, include: { invoice: { select: { id: true } } } });
    if (!proposal) throw Object.assign(new Error("Proposal not found"), { statusCode: 404 });
    if (proposal.status !== "ACCEPTED") throw Object.assign(new Error("Only ACCEPTED proposals can be converted to an invoice"), { statusCode: 422 });
    if (proposal.invoice) throw Object.assign(new Error("An invoice already exists for this proposal"), { statusCode: 409 });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    return createInvoiceWithGeneratedNumber({
      title: `Facture : ${proposal.title}`,
      description: proposal.description ?? undefined,
      amount: Number(proposal.amount ?? 0),
      currency: proposal.currency,
      clientId: proposal.clientId,
      projectId: proposal.projectId ?? undefined,
      proposalId: proposal.id,
      dueDate,
    });
  },

  async createDepositInvoiceTx(
    tx: TxClient,
    args: { title: string; description?: string; amount: number; currency: string; clientId: string; projectId?: string; proposalId: string; dueInDays?: number }
  ) {
    const now = new Date();
    const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + (args.dueInDays ?? 14));

    const MAX_ATTEMPTS = 5;
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const count = await tx.invoice.count({ where: { number: { startsWith: prefix } } });
      const number = `${prefix}-${String(count + 1 + attempt).padStart(4, "0")}`;
      try {
        return await tx.invoice.create({ data: { number, title: args.title, description: args.description, amount: args.amount, currency: args.currency, status: "DRAFT", dueDate, clientId: args.clientId, projectId: args.projectId, proposalId: args.proposalId } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && !(err.meta?.target as string[] | undefined)?.includes("proposalId")) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    throw new HttpError(409, "Could not allocate a unique invoice number, please retry", "INVOICE_NUMBER_CONFLICT", lastError);
  },

  async createBalanceInvoiceTx(
    tx: TxClient,
    args: { title: string; description?: string; amount: number; currency: string; clientId: string; projectId: string; dueInDays?: number }
  ) {
    const now = new Date();
    const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + (args.dueInDays ?? 30));

    const MAX_ATTEMPTS = 5;
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const count = await tx.invoice.count({ where: { number: { startsWith: prefix } } });
      const number = `${prefix}-${String(count + 1 + attempt).padStart(4, "0")}`;
      try {
        return await tx.invoice.create({ data: { number, title: args.title, description: args.description, amount: args.amount, currency: args.currency, status: "DRAFT", dueDate, clientId: args.clientId, projectId: args.projectId } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    throw new HttpError(409, "Could not allocate a unique invoice number, please retry", "INVOICE_NUMBER_CONFLICT", lastError);
  },
};
