// SEC-002 (registre remis à zéro le 2026-07-27, session du 2026-07-27, audit 4.4) :
// documentGeneratorService.generateInvoicePDF was hardcoded to the DEPOSIT gabarit ("Facture
// d'acompte" title, Document.type INVOICE_DEPOSIT, "Acompte 30 %" body text) regardless of
// invoice.invoiceType — but it's the same function called unconditionally for BALANCE invoices
// too (project.service.ts#clientApprove), so a client downloading the PDF of their solde invoice
// saw a document contradicting Invoice.title ("Facture de solde : ...") shown on the same client
// portal page. Fixed by branching invoicePdfWording (documentGenerator.service.ts) on
// invoice.invoiceType.
//
// This test calls the real, exported invoicePdfWording — the pure decision function
// generateInvoicePDF itself now delegates to — not a reimplementation. generateInvoicePDF's own
// PDF/upload path requires a configured S3 bucket (uploadFile), so this covers the actual defect
// (wrong title/type/text picked for BALANCE) at the boundary that doesn't need real storage.

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { invoicePdfWording } from "../src/services/documentGenerator.service.js";

describe("invoicePdfWording picks the correct gabarit per invoiceType (SEC-002)", () => {
  test("BALANCE invoice gets the solde wording, not the deposit one", () => {
    const wording = invoicePdfWording("BALANCE", "Projet X");
    assert.equal(wording.pdfTitle, "Facture de solde");
    assert.match(wording.detailLine, /Solde restant \(70 %\)/);
    assert.equal(wording.documentType, "INVOICE_BALANCE");
    assert.equal(wording.filenamePrefix, "facture-solde");
    assert.equal(wording.referencePrefix, "FS");
  });

  test("DEPOSIT invoice keeps the original acompte wording", () => {
    const wording = invoicePdfWording("DEPOSIT", "Projet X");
    assert.equal(wording.pdfTitle, "Facture d'acompte");
    assert.match(wording.detailLine, /Acompte 30 %/);
    assert.equal(wording.documentType, "INVOICE_DEPOSIT");
    assert.equal(wording.filenamePrefix, "facture-acompte");
    assert.equal(wording.referencePrefix, "FA");
  });

  test("a missing/STANDARD invoiceType falls back to the deposit wording (unchanged prior default behavior)", () => {
    const withUndefined = invoicePdfWording(undefined, "Projet X");
    const withStandard = invoicePdfWording("STANDARD", "Projet X");
    assert.equal(withUndefined.pdfTitle, "Facture d'acompte");
    assert.equal(withStandard.pdfTitle, "Facture d'acompte");
  });
});
