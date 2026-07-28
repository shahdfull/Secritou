-- Bug bloquant: Commission.paymentId was UNIQUE alone (one Commission row per payment, full
-- stop), but commissionService.computeForPaymentTx creates one row per partner sharing the
-- project's split for the SAME payment. Any project with 2+ partners violated this constraint
-- the moment a payment landed (createManyAndReturn threw a unique-constraint error). The real
-- invariant is "one row per (payment, partner)", not "one row per payment" — existing data is
-- unaffected since every payment recorded so far has produced at most one Commission row.

-- DropIndex
DROP INDEX "Commission_paymentId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Commission_paymentId_partnerId_key" ON "Commission"("paymentId", "partnerId");
