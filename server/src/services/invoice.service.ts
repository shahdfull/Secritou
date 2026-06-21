import { invoiceRepository } from "../repositories/invoice.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueEmail, enqueueNotifications } from "../jobs/queues.js";
import { invoiceSentTemplate, invoiceReminderTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import type { InvoiceStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { tenantValidation } from "./tenantValidation.service.js";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";
import { clientSuccessService } from "./clientSuccess.service.js";
import { creditNoteService } from "./creditNote.service.js";

// Transaction client type derived from the (extended) prisma client, so it matches the `tx`
// argument passed by prisma.$transaction on this codebase's extended client.
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Line items may only be added/changed/removed while the invoice is a DRAFT. Once it has been
 * sent or paid, the billed figures are locked — silently editing them would break accounting
 * consistency (the client already received a different total). Corrections must go through an
 * explicit credit-note / re-issue flow instead.
 */
function assertInvoiceDraft(status: InvoiceStatus) {
  if (status !== "DRAFT") {
    throw new HttpError(
      409,
      "Cannot modify items on a non-draft invoice",
      "INVOICE_NOT_DRAFT"
    );
  }
}

/**
 * Generates a per-company, per-month sequential invoice number (INV-YYYYMM-NNNN) based on the
 * count of existing invoices in that month, then creates the invoice. The (companyId, number)
 * unique constraint is the real guarantee: if two requests race onto the same sequence value,
 * one hits P2002 and we retry with the next number. This replaces the old timestamp-based
 * number, which produced opaque non-sequential numbers and surfaced collisions as raw 500s.
 */
async function createInvoiceWithGeneratedNumber(
  companyId: string,
  data: Omit<Parameters<typeof invoiceRepository.create>[0], "number" | "companyId">
) {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  const MAX_ATTEMPTS = 5;
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const count = await prisma.invoice.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    const number = `${prefix}-${String(count + 1 + attempt).padStart(4, "0")}`;
    try {
      return await invoiceRepository.create({ ...data, number, companyId });
    } catch (err) {
      // P2002 = unique constraint violation on (companyId, number): another request took this
      // number first. Retry with the next sequence value.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw new HttpError(
    409,
    "Could not allocate a unique invoice number, please retry",
    "INVOICE_NUMBER_CONFLICT",
    lastError
  );
}

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
    // A financial document must remain on record once issued. Only DRAFT invoices (never sent)
    // may be hard-deleted; anything else must be cancelled (void) to preserve the audit trail.
    const invoice = await invoiceRepository.findById(id, companyId);
    if (!invoice) throw new HttpError(404, "Invoice not found");
    if (invoice.status !== "DRAFT") {
      throw new HttpError(
        409,
        "Only draft invoices can be deleted; cancel the invoice instead",
        "INVOICE_NOT_DRAFT"
      );
    }
    return invoiceRepository.delete(id, companyId);
  },

  async cancel(id: string, companyId: string) {
    const invoice = await invoiceRepository.findById(id, companyId);
    if (!invoice) throw new HttpError(404, "Invoice not found");
    // PAID and already-CANCELLED invoices are terminal — voiding them makes no sense.
    if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
      throw new HttpError(
        409,
        `Cannot cancel a ${invoice.status} invoice`,
        "INVOICE_NOT_CANCELLABLE"
      );
    }
    return invoiceRepository.update(id, companyId, { status: "CANCELLED" });
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
          invoice.currency ?? "TND",
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
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id, companyId },
        select: { id: true, clientId: true, amount: true, amountPaid: true, status: true, currency: true },
      });
      if (!invoice) throw new Error("Invoice not found");

      // Idempotency guard against accidental double-submit (double-click, retry): if an
      // identical payment (same invoice, amount, recorder) was just recorded, return it
      // instead of creating a second InvoicePayment row.
      const tenSecondsAgo = new Date(Date.now() - 10_000);
      const duplicate = await tx.invoicePayment.findFirst({
        where: {
          invoiceId: id,
          amount: data.amount,
          recordedById: recordedById ?? null,
          createdAt: { gte: tenSecondsAgo },
        },
        orderBy: { createdAt: "desc" },
      });
      if (duplicate) {
        return { payment: duplicate, creditNote: null, overpaidBy: 0, clientId: invoice.clientId, deduplicated: true };
      }

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
      // was billed. The individual InvoicePayment row keeps the raw amount entered; any overpaid
      // delta is turned into a credit note (money owed back to the client) and added to the
      // client's credit balance — instead of being silently dropped as a warning.
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

      let creditNote = null;
      if (overpaidBy > 0) {
        creditNote = await creditNoteService.createCreditNoteTx(tx, {
          invoiceId: invoice.id,
          clientId: invoice.clientId,
          companyId,
          amount: overpaidBy,
          reason: `Overpayment on invoice (paid ${rawAmountPaid.toFixed(2)} vs billed ${invoiceAmount.toFixed(2)} ${invoice.currency ?? "TND"})`,
        });
      }

      return { payment, creditNote, overpaidBy, clientId: invoice.clientId, deduplicated: false };
    });

    // A deduplicated request must not re-fire notifications or recompute — the original
    // submission already did all of that.
    if (result.deduplicated) {
      return result;
    }

    // Notify company admins that a payment was recorded (outside the transaction so a
    // notification hiccup can't roll back the payment).
    const invoiceMeta = await invoiceRepository.findById(id, companyId);
    if (invoiceMeta) {
      const admins = await userRepository.findAdminsByCompanyId(companyId);
      await enqueueNotifications(
        admins.map((admin) => ({
          userId: admin.id,
          title: "Paiement reçu",
          message: `Un paiement de ${Number(data.amount).toFixed(2)} ${invoiceMeta.currency ?? "TND"} a été enregistré pour la facture ${invoiceMeta.number}.`,
        }))
      );

      // If the payment overpaid the invoice, a credit note was issued — tell the client too,
      // not just the admins, since it's money owed back to them.
      if (result.creditNote) {
        const clientUsers = await userRepository.findByClientId(invoiceMeta.clientId);
        await enqueueNotifications(
          clientUsers.map((user) => ({
            userId: user.id,
            title: "Avoir disponible",
            message: `Un avoir de ${result.overpaidBy.toFixed(2)} ${invoiceMeta.currency ?? "TND"} a été crédité sur votre compte suite à un trop-perçu sur la facture ${invoiceMeta.number}.`,
          }))
        );
      }

      // Payment rate feeds the automatic half of the client success score; recompute now so it
      // isn't stale until the nightly batch (best-effort, never blocks the payment).
      void clientSuccessService.recalcAndPersist(invoiceMeta.clientId, companyId);
    }

    return result;
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
          invoice.currency ?? "TND",
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
      // Ownership + status check before writing. Line items may only change while the invoice
      // is a DRAFT; once SENT/PAID/OVERDUE/etc. the billed figures are locked for accounting
      // integrity (use a credit note / correction flow instead).
      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: invoiceId, companyId },
        select: { status: true },
      });
      assertInvoiceDraft(invoice.status);
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
        include: { invoice: { select: { status: true } } },
      });
      if (!invoiceItem) throw new Error("Item not found");
      assertInvoiceDraft(invoiceItem.invoice.status);

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
      const existing = await tx.invoiceItem.findUnique({
        where: { id, invoice: { companyId } },
        include: { invoice: { select: { status: true } } },
      });
      if (!existing) throw new HttpError(404, "Item not found");
      assertInvoiceDraft(existing.invoice.status);
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

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    return createInvoiceWithGeneratedNumber(companyId, {
      title: `Facture — ${proposal.title}`,
      description: proposal.description ?? undefined,
      amount: Number(proposal.amount ?? 0),
      currency: proposal.currency,
      clientId: proposal.clientId,
      projectId: proposal.projectId ?? undefined,
      proposalId: proposal.id,
      dueDate,
    });
  },
};
