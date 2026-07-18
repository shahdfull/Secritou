// RG-001 (REFERENTIEL.md §5) : "Toute proposition et toute facture est libellée en TND."
// Previously verifie: schema_seul only — Proposal.currency/Invoice.currency have
// @default("TND") in schema.prisma (structure), but nothing in the application code confirmed
// that no other value could actually be written. This is a negative/exclusivity assertion
// ("every proposal/invoice IS TND", i.e. no other currency is ever accepted), which CLAUDE.md
// requires verifie: test for, not schema_seul.
//
// Direct reading of invoice.validator.ts/proposal.validator.ts found a real gap (SEC-032):
// currencyCode was `z.string().length(3).toUpperCase()` — any 3-letter currency code (USD, EUR,
// etc.) passed validation on POST /invoices and POST /proposals, with no application-level
// filter anywhere in invoice.service.ts/proposal.service.ts either. DEFAULT_CURRENCY = "TND" is
// already used as a hard filter in analytics/forecast repositories (executiveMetrics.repository
// .ts, revenueForecast.repository.ts) — an invoice created in another currency would be silently
// excluded from every financial KPI, not just "not TND" but invisible to the dashboard entirely.
//
// Fixed: currencyCode changed to `z.literal(DEFAULT_CURRENCY)` in both validators.
//
// This test imports and calls the real createInvoiceSchema/createProposalSchema (not local
// reimplementations, unlike validators.test.ts's own copies) and confirms a non-TND currency is
// rejected, while TND (explicit or defaulted) is accepted.

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { createInvoiceSchema } from "../src/validators/invoice.validator.js";
import { createProposalSchema } from "../src/validators/proposal.validator.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("RG-001 : currency is always TND, no other value is ever accepted (SEC-032)", () => {
  test("createInvoiceSchema rejects a non-TND currency", () => {
    const result = createInvoiceSchema.safeParse({
      body: { title: "Test", amount: 100, clientId: VALID_UUID, currency: "USD" },
    });
    assert.equal(result.success, false, "a USD invoice must be rejected by the real validator");
  });

  test("createInvoiceSchema accepts TND explicitly and defaults to TND when omitted", () => {
    const explicit = createInvoiceSchema.safeParse({
      body: { title: "Test", amount: 100, clientId: VALID_UUID, currency: "TND" },
    });
    assert.equal(explicit.success, true);

    const omitted = createInvoiceSchema.safeParse({
      body: { title: "Test", amount: 100, clientId: VALID_UUID },
    });
    assert.equal(omitted.success, true);
    if (omitted.success) assert.equal(omitted.data.body.currency, "TND");
  });

  test("createProposalSchema rejects a non-TND currency", () => {
    const result = createProposalSchema.safeParse({
      body: { title: "Test", clientId: VALID_UUID, currency: "EUR" },
    });
    assert.equal(result.success, false, "a EUR proposal must be rejected by the real validator");
  });

  test("createProposalSchema accepts TND explicitly and defaults to TND when omitted", () => {
    const explicit = createProposalSchema.safeParse({
      body: { title: "Test", clientId: VALID_UUID, currency: "TND" },
    });
    assert.equal(explicit.success, true);

    const omitted = createProposalSchema.safeParse({
      body: { title: "Test", clientId: VALID_UUID },
    });
    assert.equal(omitted.success, true);
    if (omitted.success) assert.equal(omitted.data.body.currency, "TND");
  });
});
