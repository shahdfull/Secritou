// Credit Note service : records money owed back to a client (overpayment or correction).
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";
import { roundMoney } from "../utils/vat.js";
import { userRepository } from "../repositories/user.repository.js";
import { clientRepository } from "../repositories/client.repository.js";
import { enqueueNotifications } from "../jobs/queues.js";
import { Prisma } from "@prisma/client";
import type { InvoiceStatus } from "@prisma/client";
import { notifyN8n } from "../utils/webhook.js";
import { env } from "../config/env.js";
import { auditLogService } from "./auditLog.service.js";

// Transaction client type (matches the tx passed by prisma.$transaction on the extended client).
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// A bare `Date.now()` collides under concurrent creation within the same millisecond (two
// simultaneous overpayments, or a double-click on the explicit endpoint), producing an
// unhandled Prisma P2002 on CreditNote.number's @unique constraint. This module-level counter
// is never reset or wrapped, so it can never repeat within the process's lifetime regardless of
// call rate — cheaper and more robust than catching P2002 and retrying, since createCreditNoteTx
// runs inside callers' own transactions (invoice.service.ts#addPayment) where a mid-transaction
// retry would need to restart the whole enclosing transaction, not just this step.
let creditNoteSequence = 0;

function generateCreditNoteNumber() {
  creditNoteSequence += 1;
  return `CN-${Date.now()}-${creditNoteSequence}`;
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

  async create(invoiceId: string, data: { amount: number; reason: string }, actorId?: string, actorRole?: string) {
    if (data.amount <= 0) throw new HttpError(400, "Credit note amount must be positive", "INVALID_CREDIT_AMOUNT");

    const creditNote = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, clientId: true, amountPaid: true } });
      if (!invoice) throw new HttpError(404, "Invoice not found");

      // SEC-184: a credit note can never exceed what the client has actually paid on the
      // invoice MINUS whatever has already been credited back on it — CreditNote has no
      // status/cancellation field (every row counts), so comparing only against amountPaid lets
      // repeated credit notes on the same invoice cumulatively exceed what was ever received.
      const existing = await tx.creditNote.aggregate({ where: { invoiceId }, _sum: { amount: true } });
      const alreadyCredited = Number(existing._sum.amount ?? 0);
      const remainingCreditable = Number(invoice.amountPaid) - alreadyCredited;
      if (data.amount > remainingCreditable) {
        throw new HttpError(409, "Credit note amount exceeds the amount paid on this invoice", "CREDIT_EXCEEDS_PAID");
      }

      return createCreditNoteTx(tx, { invoiceId: invoice.id, clientId: invoice.clientId, amount: data.amount, reason: data.reason });
    });

    void auditLogService.record({ actorId, actorRole, action: "creditNote.create", entityType: "CreditNote", entityId: creditNote.id, after: { number: creditNote.number, amount: data.amount, invoiceId, reason: data.reason } });

    const admins = await userRepository.findAdmins();
    await enqueueNotifications(admins.map((admin) => ({ userId: admin.id, title: "Avoir émis", message: `Un avoir de ${data.amount.toFixed(2)} a été émis (${creditNote.number}).` })));

    const client = await clientRepository.findById(creditNote.clientId).catch(() => null);
    void notifyN8n("creditNote.issued", {
      creditNoteId: creditNote.id,
      number: creditNote.number,
      amount: data.amount,
      clientId: creditNote.clientId,
      clientName: client?.name,
      adminUrl: `${env.FRONTEND_URL}/app/commercial?tab=invoices`,
      agencyEmail: env.CONTACT_RECEIVER_EMAIL,
    });

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
  async applyCredit(creditNoteId: string, targetInvoiceId: string, actorId?: string, actorRole?: string) {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Load and validate the target invoice
      const invoice = await tx.invoice.findUnique({
        where: { id: targetInvoiceId },
        select: { id: true, clientId: true, amount: true, amountPaid: true, status: true, currency: true },
      });
      if (!invoice) throw new HttpError(404, "Invoice not found");
      if (invoice.status === "PAID") throw new HttpError(409, "Cannot apply credit to an already paid invoice", "INVOICE_ALREADY_PAID");
      if (invoice.status === "CANCELLED") throw new HttpError(409, "Cannot apply credit to a cancelled invoice", "INVOICE_CANCELLED");

      // 2. Load credit note and mark as applied atomically with conditional update.
      // Prisma throws P2025 (not a null return) when the where clause matches nothing —
      // this catch is what actually produces the intended 409, not the dead `if (!cn)`
      // below it (kept only because narrowing `cn` to non-undefined satisfies the compiler
      // for the reads on it further down).
      let cn: { id: string; amount: Prisma.Decimal; clientId: string; number: string };
      try {
        cn = await tx.creditNote.update({
          where: {
            id: creditNoteId,
            appliedAt: null, // Only update if not already applied
            clientId: invoice.clientId // Ensure same client
          },
          data: { appliedAt: new Date(), appliedToInvoiceId: targetInvoiceId },
          select: { id: true, amount: true, clientId: true, number: true },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          throw new HttpError(409, "This credit note has already been applied or belongs to a different client", "CREDIT_ALREADY_APPLIED");
        }
        throw err;
      }
      if (!cn) throw new HttpError(409, "This credit note has already been applied or belongs to a different client", "CREDIT_ALREADY_APPLIED");

      // 3. Compute the applicable amount (capped at remaining balance and client credit balance)
      const client = await tx.client.findUnique({ where: { id: cn.clientId }, select: { creditBalance: true } });
      const clientBalance = Number(client?.creditBalance ?? 0);
      const remaining = roundMoney(Number(invoice.amount) - Number(invoice.amountPaid));
      const applicable = roundMoney(Math.min(Number(cn.amount), remaining, clientBalance));

      if (applicable <= 0) {
        // Rollback the credit note update since we can't apply
        await tx.creditNote.update({
          where: { id: creditNoteId },
          data: { appliedAt: null, appliedToInvoiceId: null },
        });
        throw new HttpError(409, "No credit can be applied: the invoice is already covered or the client balance is empty", "NO_APPLICABLE_CREDIT");
      }

      // 4. Update the invoice
      const newAmountPaid = roundMoney(Number(invoice.amountPaid) + applicable);
      const invoiceTotal = Number(invoice.amount);
      const newStatus: InvoiceStatus = newAmountPaid >= invoiceTotal ? "PAID" : newAmountPaid > 0 ? "PARTIAL" : invoice.status as InvoiceStatus;

      await tx.invoice.update({
        where: { id: targetInvoiceId },
        data: { amountPaid: newAmountPaid, status: newStatus, paidAt: newStatus === "PAID" ? new Date() : undefined },
      });

      // 5. Decrement client credit balance
      await tx.client.update({ where: { id: cn.clientId }, data: { creditBalance: { decrement: applicable } } });

      return { creditNote: cn, appliedAmount: applicable, invoiceStatus: newStatus, currency: invoice.currency };
    });

    void auditLogService.record({
      actorId,
      actorRole,
      action: "creditNote.apply",
      entityType: "CreditNote",
      entityId: result.creditNote.id,
      after: { appliedToInvoiceId: targetInvoiceId, appliedAmount: result.appliedAmount, invoiceStatus: result.invoiceStatus },
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

