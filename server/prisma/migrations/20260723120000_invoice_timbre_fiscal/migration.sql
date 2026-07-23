-- RG-024 / SEC-198: the flat Tunisian stamp duty (timbre fiscal) shown on deposit/balance
-- invoice PDFs was never stored on Invoice, so invoiceService.addPayment (which compares any
-- payment to Invoice.amount alone) always treated a client's exact PDF payment as an
-- overpayment, triggering an automatic CreditNote of the timbre's amount on every VAT invoice.
-- Existing DEPOSIT/BALANCE invoices are left with timbreFiscal = NULL (their amount was already
-- set without it, and back-filling amount retroactively would silently change a stored total on
-- rows that may already be paid/reconciled) — only newly created invoices get it going forward.
ALTER TABLE "Invoice" ADD COLUMN "timbreFiscal" DECIMAL(14,3);
