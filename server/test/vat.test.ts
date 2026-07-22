// No test imported and called the real computeVat/computeVatSlice (src/utils/vat.ts) before this
// file — the only VAT-related test, depositRateSingleSource.test.ts, covers DEPOSIT_RATE only.
// Every invoice creation path (createFromProposal, createDepositInvoiceTx, createBalanceInvoiceTx)
// relies on computeVat to split a HT amount into HT/TVA/TTC, so an untested computeVat is an
// untested core of every invoice amount stored in the database.

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { computeVat, computeVatSlice, roundMoney, TVA_RATE, DEPOSIT_RATE } from "../src/utils/vat.js";

describe("computeVat (real code, not a reimplementation)", () => {
  test("splits a HT amount into HT/TVA/TTC at the default 19% rate", () => {
    const result = computeVat(1000);
    assert.equal(result.amountHT, 1000);
    assert.equal(result.tvaRate, TVA_RATE);
    assert.equal(result.tvaAmount, 190);
    assert.equal(result.amountTTC, 1190);
  });

  test("rounds to 3 decimal places (millimes), not 2", () => {
    // 333.333 * 1.19 = 396.66627 -> rounds to 396.666, not 396.67
    const result = computeVat(333.333);
    assert.equal(result.amountTTC, 396.666);
    assert.equal(result.tvaAmount, roundMoney(result.amountTTC - result.amountHT));
  });

  test("tvaAmount is always amountTTC - amountHT, never independently rounded to a different total", () => {
    const result = computeVat(123.456);
    assert.equal(roundMoney(result.amountHT + result.tvaAmount), result.amountTTC);
  });

  test("accepts an explicit rate override, not just the TVA_RATE default", () => {
    const result = computeVat(1000, 0.07);
    assert.equal(result.tvaRate, 0.07);
    assert.equal(result.tvaAmount, 70);
    assert.equal(result.amountTTC, 1070);
  });

  test("zero HT amount produces zero everywhere, not NaN or a rate-only artifact", () => {
    const result = computeVat(0);
    assert.equal(result.amountHT, 0);
    assert.equal(result.tvaAmount, 0);
    assert.equal(result.amountTTC, 0);
  });
});

describe("computeVatSlice (real code, not a reimplementation)", () => {
  test("splits a fraction of the total HT before applying VAT — the deposit/balance invoice pattern", () => {
    // This is exactly how invoice.service.ts derives a deposit invoice's amountHT from a
    // proposal's total HT amount (proposalAmount * DEPOSIT_RATE), then VATs that slice.
    const totalHT = 1000;
    const deposit = computeVatSlice(totalHT, DEPOSIT_RATE);
    assert.equal(deposit.amountHT, 300);
    assert.equal(deposit.tvaAmount, 57);
    assert.equal(deposit.amountTTC, 357);
  });

  test("deposit + balance slices sum back to the full VAT-inclusive total (no rounding drift introduced by slicing)", () => {
    const totalHT = 1000;
    const deposit = computeVatSlice(totalHT, DEPOSIT_RATE);
    const balance = computeVatSlice(totalHT, 1 - DEPOSIT_RATE);
    const wholeTotal = computeVat(totalHT);
    assert.equal(roundMoney(deposit.amountTTC + balance.amountTTC), wholeTotal.amountTTC);
  });

  test("accepts an explicit rate override like computeVat", () => {
    const result = computeVatSlice(1000, 0.5, 0.07);
    assert.equal(result.amountHT, 500);
    assert.equal(result.tvaRate, 0.07);
    assert.equal(result.tvaAmount, 35);
  });
});
