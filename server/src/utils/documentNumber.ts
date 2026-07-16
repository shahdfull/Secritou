// Sequential, gapless numbering for accounting documents (invoices and credit notes).
//
// Tunisian tax rules require issued accounting documents to carry an unbroken sequence, so the
// counter is incremented inside the *same* transaction that persists the document: a rollback
// takes the number with it, and no number is ever allocated without a document behind it.
//
// Lives in utils/ rather than invoice.service.ts because creditNote.service.ts needs it too, and
// invoice.service.ts already imports creditNote.service.ts (importing back would be a cycle — the
// CI runs `madge --circular`).
import type { prisma } from "../config/prisma.js";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function monthlyPrefix(kind: "INV" | "CN"): string {
  const now = new Date();
  return `${kind}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function currentInvoicePrefix(): string {
  return monthlyPrefix("INV");
}

export function currentCreditNotePrefix(): string {
  return monthlyPrefix("CN");
}

/**
 * Allocates the next number for a prefix (e.g. INV-202607-0001, CN-202607-0003).
 * Must be called inside the transaction that creates the document row.
 */
export async function nextDocumentNumber(tx: TxClient, prefix: string): Promise<string> {
  const counter = await tx.invoiceCounter.upsert({
    where: { prefix },
    create: { prefix, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${String(counter.value).padStart(4, "0")}`;
}
