import { invoiceRepository } from "../repositories/invoice.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueEmail } from "../jobs/queues.js";
import { invoiceSentTemplate, invoiceReminderTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import type { InvoiceStatus } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { tenantValidation } from "./tenantValidation.service.js";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";

// Transaction client type derived from the (extended) prisma client, so it matches the `tx`
// argument passed by prisma.$transaction on this codebase's extended client.
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Line items are the source of truth for an invoice total. Whenever items change we recompute
 * Invoice.amount = SUM(items.total) so the headline amount (used for payment status, the PDF,
 * and dashboard aggregates) can never drift from the itemisation.
 */
async function recomputeInvoiceAmount(
  tx: TxClient,
  invoiceId: string,
  companyId: string
) {
  const agg = await tx.invoiceItem.aggregate({
    where: { invoiceId, invoice: { companyId } },
    _sum: { total: true },
  });
  const amount = Number(agg._sum.total ?? 0);
  await tx.invoice.update({ where: { id: invoiceId, companyId }, data: { amount } });
}

export const invoiceService = {
  async getAllByClientId(
    clientId: string,
    options: { page: number; pageSize: number; status?: InvoiceStatus }
  ) {
    return invoiceRepository.findAllByClientId(clientId, options);
  },

  async getAll(
    options: ListQueryOptions & {
      companyId: string;
      clientId?: string;
      status?: InvoiceStatus;
      search?: string;
    }
  ) {
    return invoiceRepository.findAll(options);
  },

  async getById(id: string, companyId: string) {
    return invoiceRepository.findById(id, companyId);
  },

  async create(
    data: {
      number: string;
      title: string;
      description?: string;
      amount: number;
      currency?: string;
      dueDate?: Date;
      pdfUrl?: string;
      clientId: string;
      projectId?: string;
      proposalId?: string;
    },
    companyId: string
  ) {
    await tenantValidation.assertClientInCompany(data.clientId, companyId);
    return invoiceRepository.create({ ...data, companyId });
  },

  async update(
    id: string,
    companyId: string,
    data: Partial<{
      number: string;
      title: string;
      description: string;
      amount: number;
      currency: string;
      dueDate: Date;
      pdfUrl: string;
    }>
  ) {
    // When an invoice has line items, its amount is derived from them (recomputeInvoiceAmount)
    // and must not be set directly — otherwise the two would drift. Invoices with no items
    // (e.g. created from a proposal without itemisation) keep amount manually editable.
    if (data.amount !== undefined) {
      const itemCount = await prisma.invoiceItem.count({ where: { invoiceId: id, invoice: { companyId } } });
      if (itemCount > 0) {
        throw new HttpError(
          409,
          "This invoice's amount is derived from its line items and cannot be edited directly",
          "INVOICE_AMOUNT_DERIVED"
        );
      }
    }
    return invoiceRepository.update(id, companyId, data);
  },

  async delete(id: string, companyId: string) {
    return invoiceRepository.delete(id, companyId);
  },

  async send(id: string, companyId: string) {
    const invoice = await invoiceRepository.findById(id, companyId);
    const updated = await invoiceRepository.update(id, companyId, {
      status: "SENT",
      sentAt: new Date(),
    });

    if (invoice) {
      const clientUsers = await userRepository.findByClientId(invoice.clientId);
      const dueDate = invoice.dueDate
        ? new Date(invoice.dueDate).toLocaleDateString("fr-FR")
        : "—";
      const invoiceUrl = `${env.FRONTEND_URL}/client/invoices`;

      for (const user of clientUsers) {
        const { subject, html } = invoiceSentTemplate(
          user.name ?? invoice.clientId,
          invoice.number,
          Number(invoice.amount),
          invoice.currency ?? "EUR",
          dueDate,
          invoiceUrl
        );
        void enqueueEmail({ to: user.email, subject, html });
      }
    }

    return updated;
  },

  async addPayment(
    id: string,
    companyId: string,
    data: { amount: number; method?: string; reference?: string; paidAt?: Date },
    recordedById?: string
  ) {
    // Payment positivity is enforced by addPaymentSchema (amount = positiveDecimal); we do
    // not re-check it here to avoid two diverging sources of truth.
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id, companyId },
        select: { id: true, amount: true, amountPaid: true, status: true, currency: true },
      });
      if (!invoice) throw new Error("Invoice not found");

      const payment = await tx.invoicePayment.create({
        data: {
          invoiceId: id,
          amount: data.amount,
          method: data.method,
          reference: data.reference,
          recordedById,
          paidAt: data.paidAt ?? new Date(),
        },
      });

      // Cap amountPaid at the invoice total so the recorded "paid" figure never exceeds what
      // was billed. The individual InvoicePayment row keeps the raw amount entered; the
      // overpaid delta is surfaced to the caller as a warning rather than crashing the request
      // (an admin may legitimately enter a payment exceeding the total — credit, late discount).
      const rawAmountPaid = Number(invoice.amountPaid) + data.amount;
      const invoiceAmount = Number(invoice.amount);
      const newAmountPaid = Math.min(rawAmountPaid, invoiceAmount);
      const overpaidBy = rawAmountPaid - invoiceAmount;

      const newStatus: InvoiceStatus =
        newAmountPaid >= invoiceAmount
          ? "PAID"
          : newAmountPaid > 0
          ? "PARTIAL"
          : invoice.status as InvoiceStatus;

      await tx.invoice.update({
        where: { id, companyId },
        data: {
          amountPaid: newAmountPaid,
          status: newStatus,
          paidAt: newStatus === "PAID" ? new Date() : undefined,
        },
      });

      return {
        payment,
        warning:
          overpaidBy > 0
            ? `Payment exceeds the invoice balance by ${overpaidBy.toFixed(2)} ${invoice.currency ?? "EUR"}`
            : undefined,
      };
    });
  },

  async addReminder(id: string, companyId: string, type: string) {
    const invoice = await invoiceRepository.findById(id, companyId);
    const reminder = await invoiceRepository.addReminder(id, companyId, {
      type,
      sentAt: new Date(),
    });

    if (invoice) {
      const clientUsers = await userRepository.findByClientId(invoice.clientId);
      const dueDate = invoice.dueDate
        ? new Date(invoice.dueDate).toLocaleDateString("fr-FR")
        : "—";
      const now = new Date();
      const daysOverdue = invoice.dueDate
        ? Math.max(
            0,
            Math.floor(
              (now.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
            )
          )
        : 0;
      const invoiceUrl = `${env.FRONTEND_URL}/client/invoices`;

      for (const user of clientUsers) {
        const { subject, html } = invoiceReminderTemplate(
          user.name ?? invoice.clientId,
          invoice.number,
          Number(invoice.amount),
          invoice.currency ?? "EUR",
          dueDate,
          daysOverdue,
          invoiceUrl
        );
        void enqueueEmail({ to: user.email, subject, html });
      }
    }

    return reminder;
  },

  async addItem(
    invoiceId: string,
    companyId: string,
    data: { description: string; quantity: number; unitPrice: number }
  ) {
    const total = data.quantity * data.unitPrice;
    return prisma.$transaction(async (tx) => {
      // Ownership check before writing
      await tx.invoice.findUniqueOrThrow({
        where: { id: invoiceId, companyId },
        select: { id: true },
      });
      const item = await tx.invoiceItem.create({ data: { ...data, total, invoiceId } });
      await recomputeInvoiceAmount(tx, invoiceId, companyId);
      return item;
    });
  },

  async updateItem(
    id: string,
    companyId: string,
    data: { description?: string; quantity?: number; unitPrice?: number }
  ) {
    return prisma.$transaction(async (tx) => {
      const invoiceItem = await tx.invoiceItem.findUnique({
        where: { id, invoice: { companyId } },
      });
      if (!invoiceItem) throw new Error("Item not found");

      const updatedQuantity = data.quantity ?? invoiceItem.quantity;
      const updatedUnitPrice = data.unitPrice ?? Number(invoiceItem.unitPrice);
      const total = updatedQuantity * updatedUnitPrice;

      const item = await tx.invoiceItem.update({
        where: { id, invoice: { companyId } },
        data: { ...data, total },
      });
      await recomputeInvoiceAmount(tx, invoiceItem.invoiceId, companyId);
      return item;
    });
  },

  async deleteItem(id: string, companyId: string) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.invoiceItem.delete({
        where: { id, invoice: { companyId } },
      });
      await recomputeInvoiceAmount(tx, item.invoiceId, companyId);
      return item;
    });
  },

  async createFromProposal(proposalId: string, companyId: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { invoice: { select: { id: true } } },
    });
    if (!proposal || proposal.companyId !== companyId) {
      throw Object.assign(new Error("Proposal not found"), { statusCode: 404 });
    }
    if (proposal.status !== "ACCEPTED") {
      throw Object.assign(
        new Error("Only ACCEPTED proposals can be converted to an invoice"),
        { statusCode: 422 }
      );
    }
    if (proposal.invoice) {
      throw Object.assign(
        new Error("An invoice already exists for this proposal"),
        { statusCode: 409 }
      );
    }

    const now = new Date();
    const number = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getTime()).slice(-4)}`;
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 30);

    return invoiceRepository.create({
      number,
      title: `Facture — ${proposal.title}`,
      description: proposal.description ?? undefined,
      amount: Number(proposal.amount ?? 0),
      currency: proposal.currency,
      clientId: proposal.clientId,
      companyId,
      projectId: proposal.projectId ?? undefined,
      proposalId: proposal.id,
      dueDate,
    });
  },
};
