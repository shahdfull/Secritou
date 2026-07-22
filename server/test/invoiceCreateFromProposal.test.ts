// invoiceService.createFromProposal had zero test coverage — the only invoice-VAT-related test
// (depositRateSingleSource.test.ts) exercises clientApprove's deposit/balance path, never this
// standalone conversion path. This is the only place that converts an ACCEPTED Proposal directly
// into a STANDARD Invoice (not via the deposit/balance cascade), and it's the one call site that
// derives its amount/amountHT/tvaRate/tvaAmount from computeVat on the proposal's raw amount —
// worth its own real-code proof, not assumed correct by association with the cascade path.
//
// This test imports and calls the real invoiceService.createFromProposal against a real,
// migrated database. Skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let invoiceService: typeof import("../src/services/invoice.service.js").invoiceService;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdProposalIds: string[] = [];
const createdInvoiceIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ invoiceService } = await import("../src/services/invoice.service.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("invoiceService.createFromProposal (real code, not a reimplementation)", () => {
  test("creates an invoice with amount/amountHT/tvaRate/tvaAmount actually derived from computeVat on the proposal's HT amount", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: `createFromProposal-client-${Date.now()}` } });
    createdClientIds.push(client.id);
    const proposal = await prisma.proposal.create({
      data: { title: "Test proposal", amount: 1000, currency: "TND", status: "ACCEPTED", clientId: client.id },
    });
    createdProposalIds.push(proposal.id);

    const invoice = await invoiceService.createFromProposal(proposal.id);
    createdInvoiceIds.push(invoice.id);

    assert.equal(Number(invoice.amountHT), 1000);
    assert.equal(Number(invoice.tvaRate), 0.19);
    assert.equal(Number(invoice.tvaAmount), 190);
    assert.equal(Number(invoice.amount), 1190, "amount (TTC) must be the VAT-inclusive total, not the proposal's raw HT amount");
    assert.equal(invoice.clientId, client.id);
    assert.equal(invoice.proposalId, proposal.id);

    const persisted = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    assert.equal(Number(persisted!.amount), 1190, "the VAT-inclusive amount must actually be persisted, not just returned");
  });

  test("rejects a proposal that is not ACCEPTED with 422", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: `createFromProposal-notaccepted-${Date.now()}` } });
    createdClientIds.push(client.id);
    const proposal = await prisma.proposal.create({
      data: { title: "Draft proposal", amount: 500, currency: "TND", status: "SENT", clientId: client.id },
    });
    createdProposalIds.push(proposal.id);

    await assert.rejects(
      () => invoiceService.createFromProposal(proposal.id),
      (err: unknown) => {
        assert.equal((err as { statusCode?: number }).statusCode, 422);
        return true;
      }
    );
  });

  test("rejects a proposal that already has an invoice with 409, never creating a second one", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: `createFromProposal-dup-${Date.now()}` } });
    createdClientIds.push(client.id);
    const proposal = await prisma.proposal.create({
      data: { title: "Already invoiced proposal", amount: 200, currency: "TND", status: "ACCEPTED", clientId: client.id },
    });
    createdProposalIds.push(proposal.id);

    const first = await invoiceService.createFromProposal(proposal.id);
    createdInvoiceIds.push(first.id);

    await assert.rejects(
      () => invoiceService.createFromProposal(proposal.id),
      (err: unknown) => {
        assert.equal((err as { statusCode?: number }).statusCode, 409);
        return true;
      }
    );

    const count = await prisma.invoice.count({ where: { proposalId: proposal.id } });
    assert.equal(count, 1, "a rejected second call must not create a second invoice");
  });

  test("rejects a non-existent proposal with 404", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    await assert.rejects(
      () => invoiceService.createFromProposal("00000000-0000-0000-0000-000000000000"),
      (err: unknown) => {
        assert.equal((err as { statusCode?: number }).statusCode, 404);
        return true;
      }
    );
  });
});
