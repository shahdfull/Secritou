// Credit Note service : records money owed back to a client (overpayment or correction).
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueNotifications } from "../jobs/queues.js";

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
};
