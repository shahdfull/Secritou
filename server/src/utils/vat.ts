// Single source of truth for Tunisian VAT (TVA) on proposal/invoice amounts.
// Convention: Proposal.amount and quote PDFs are always HT (tax-exclusive).
export const TVA_RATE = 0.19;

// SEC-183: the deposit rate (RG-002/Cadrage §6) used to be an independent 0.3 literal copied at
// 3 call sites (project.service.ts#clientApprove, proposal.service.ts#acceptWithCascade,
// documentGenerator.service.ts#generateQuotePDF) — a future rate change fixed at only one site
// would silently desync the quote PDF's promised split from the actual deposit/balance invoices.
export const DEPOSIT_RATE = 0.3;

// RG-024 / SEC-198: flat Tunisian stamp duty (barème confirmé) applied to deposit and balance
// invoices. Previously a constant local to documentGenerator.service.ts, added to the PDF's "Net
// à payer" but never stored on Invoice.amount nor checked by invoiceService.addPayment (which
// compares a payment only to the stored amount) — a client paying exactly the PDF's stated total
// always overpaid by this amount, triggering an automatic CreditNote on every VAT invoice.
export const TIMBRE_FISCAL = 0.6;

// TND is denominated in millimes (3 decimal places) — round to 3, not 2.
export function roundMoney(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export interface VatBreakdown {
  amountHT: number;
  tvaRate: number;
  tvaAmount: number;
  amountTTC: number;
}

export function computeVat(amountHT: number, tvaRate: number = TVA_RATE): VatBreakdown {
  const ht = roundMoney(amountHT);
  const ttc = roundMoney(ht * (1 + tvaRate));
  return { amountHT: ht, tvaRate, tvaAmount: roundMoney(ttc - ht), amountTTC: ttc };
}

// Splits a total HT amount into a percentage slice, itself broken down into HT/TVA/TTC.
// Used for deposit (30%) / balance (70%) invoices derived from a proposal's HT amount.
export function computeVatSlice(totalHT: number, fraction: number, tvaRate: number = TVA_RATE): VatBreakdown {
  return computeVat(totalHT * fraction, tvaRate);
}
