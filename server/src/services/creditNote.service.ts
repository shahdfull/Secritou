// Credit Note service : records money owed back to a client (overpayment or correction).
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueNotifications } from "../jobs/queues.js";
import type { InvoiceStatus } from "@prisma/client";

// Transaction client type (matches the tx passed by prisma.$transaction on the extended client).
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function generateCreditNoteNumber() {
  return `CN-${Date.now()}`;
}

/**
 * Creates a credit note against an invoice and credits the client's balance, atomically.
 * Used both by the explicit endpoint and by the automatic overpayment path in addPayment.
 */
async function createCreditNoteTx(tx: TxClient, params: { invoiceId: string; clientId: string; amount: number; reason: string }) {
  const creditNote = await tx.creditNote.create({
    data: { number: generateCreditNoteNumber(), amount: params.amount, reason: params.reason, invoiceId: params.invoiceId, clientId: params.clientId },
  });

  await tx.client.update({ where: { id: params.clientId }, data: { creditBalance: { increment: params.amount } } });

  return creditNote;
}

export const creditNoteService = {
  createCreditNoteTx,

  async create(invoiceId: string, data: { amount: number; reason: string }) {
    if (data.amount <= 0) throw new HttpError(400, "Credit note amount must be positive", "INVALID_CREDIT_AMOUNT");

    const creditNote = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, clientId: true, amountPaid: true } });
      if (!invoice) throw new HttpError(404, "Invoice not found");

      // A credit note can never exceed what the client has actually paid on the invoice.
      if (data.amount > Number(invoice.amountPaid)) {
        throw new HttpError(409, "Credit note amount exceeds the amount paid on this invoice", "CREDIT_EXCEEDS_PAID");
      }

      return createCreditNoteTx(tx, { invoiceId: invoice.id, clientId: invoice.clientId, amount: data.amount, reason: data.reason });
    });

    const admins = await userRepository.findAdmins();
    await enqueueNotifications(admins.map((admin) => ({ userId: admin.id, title: "Avoir émis", message: `Un avoir de ${data.amount.toFixed(2)} a été émis (${creditNote.number}).` })));

    return creditNote;
  },

  async listByInvoice(invoiceId: string) {
    return prisma.creditNote.findMany({ where: { invoiceId }, orderBy: { createdAt: "desc" } });
  },

  async listByClient(clientId: string) {
    return prisma.creditNote.findMany({
      where: { clientId },
      include: {
        invoice: { select: { number: true } },
        appliedToInvoice: { select: { number: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getAll() {
    return prisma.creditNote.findMany({
      include: {
        client: { select: { name: true } },
        invoice: { select: { number: true } },
        appliedToInvoice: { select: { number: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Applies a credit note to an invoice, atomically:
   *  1. Validates the credit note is not already consumed.
   *  2. Validates invoice is not PAID or CANCELLED, and belongs to the same client.
   *  3. Computes applicable = min(creditNote.amount, remainingBalance, clientCreditBalance).
   *  4. Increments invoice.amountPaid and updates invoice status.
   *  5. Decrements client.creditBalance.
   *  6. Stamps creditNote.appliedAt + creditNote.appliedToInvoiceId.
   */
  async applyCredit(creditNoteId: string, targetInvoiceId: string) {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Load and validate the credit note
      const cn = await tx.creditNote.findUnique({
        where: { id: creditNoteId },
        select: { id: true, amount: true, clientId: true, appliedAt: true, number: true },
      });
      if (!cn) throw new HttpError(404, "Credit note not found");
      if (cn.appliedAt) throw new HttpError(409, "This credit note has already been applied to an invoice", "CREDIT_ALREADY_APPLIED");

      // 2. Load and validate the target invoice
      const invoice = await tx.invoice.findUnique({
        where: { id: targetInvoiceId },
        select: { id: true, clientId: true, amount: true, amountPaid: true, status: true, currency: true },
      });
      if (!invoice) throw new HttpError(404, "Invoice not found");
      if (invoice.status === "PAID") throw new HttpError(409, "Cannot apply credit to an already paid invoice", "INVOICE_ALREADY_PAID");
      if (invoice.status === "CANCELLED") throw new HttpError(409, "Cannot apply credit to a cancelled invoice", "INVOICE_CANCELLED");
      if (invoice.clientId !== cn.clientId) throw new HttpError(403, "Credit note and invoice belong to different clients", "CLIENT_MISMATCH");

      // 3. Compute the applicable amount (capped at remaining balance and client credit balance)
      const client = await tx.client.findUnique({ where: { id: cn.clientId }, select: { creditBalance: true } });
      const clientBalance = Number(client?.creditBalance ?? 0);
      const remaining = Math.round((Number(invoice.amount) - Number(invoice.amountPaid)) * 100) / 100;
      const applicable = Math.round(Math.min(Number(cn.amount), remaining, clientBalance) * 100) / 100;

      if (applicable <= 0) {
        throw new HttpError(409, "No credit can be applied: the invoice is already covered or the client balance is empty", "NO_APPLICABLE_CREDIT");
      }

      // 4. Update the invoice
      const newAmountPaid = Math.round((Number(invoice.amountPaid) + applicable) * 100) / 100;
      const invoiceTotal = Number(invoice.amount);
      const newStatus: InvoiceStatus = newAmountPaid >= invoiceTotal ? "PAID" : newAmountPaid > 0 ? "PARTIAL" : invoice.status as InvoiceStatus;

      await tx.invoice.update({
        where: { id: targetInvoiceId },
        data: { amountPaid: newAmountPaid, status: newStatus, paidAt: newStatus === "PAID" ? new Date() : undefined },
      });

      // 5. Decrement client credit balance
      await tx.client.update({ where: { id: cn.clientId }, data: { creditBalance: { decrement: applicable } } });

      // 6. Mark the credit note as consumed
      const updatedCn = await tx.creditNote.update({
        where: { id: creditNoteId },
        data: { appliedAt: new Date(), appliedToInvoiceId: targetInvoiceId },
      });

      return { creditNote: updatedCn, appliedAmount: applicable, invoiceStatus: newStatus, currency: invoice.currency };
    });

    // Notify admins
    const admins = await userRepository.findAdmins();
    await enqueueNotifications(
      admins.map((admin) => ({
        userId: admin.id,
        title: "Avoir imputé",
        message: `L'avoir ${result.creditNote.number} (${result.appliedAmount.toFixed(2)} ${result.currency ?? "TND"}) a été appliqué sur la facture.`,
      }))
    );

    // Notify client users
    const clientUsers = await userRepository.findByClientId(result.creditNote.clientId);
    if (clientUsers.length > 0) {
      await enqueueNotifications(
        clientUsers.map((user) => ({
          userId: user.id,
          title: "Avoir appliqué",
          message: `Un avoir de ${result.appliedAmount.toFixed(2)} ${result.currency ?? "TND"} a été déduit de votre facture.`,
        }))
      );
    }

    return result;
  },
};

