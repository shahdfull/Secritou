// Single source of truth for Tunisian VAT (TVA) on proposal/invoice amounts.
// Convention: Proposal.amount and quote PDFs are always HT (tax-exclusive).
export const TVA_RATE = 0.19;

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
