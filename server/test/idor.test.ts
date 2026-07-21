// SEC-179: this file used to reimplement invoiceUpdate/invoiceDelete/invoiceFindById/
// proposalUpdate/proposalDelete/proposalFindById locally against a fake `where: { id, companyId }`
// — companyId doesn't exist anywhere in this mono-tenant schema (CLAUDE.md forbids reintroducing
// multi-tenancy, SEC-004). None of the 14 tests ever imported the real repositories, so the file
// proved nothing about actual IDOR protection despite its name.
//
// The real scoping model in this codebase, confirmed by reading the actual routes/controllers:
// - Invoice/Proposal direct-by-id routes (GET /invoices/:id, GET /proposals/:id) are
//   ADMIN/MANAGER only (invoice.routes.ts:325, proposal.routes.ts:268) — pole-scoped via
//   assertInvoiceInScope/assertProposalInScope (already covered by invoiceScopeManager.test.ts /
//   SEC-137 and proposalAcceptRbacHttp.test.ts / SEC-124). A CLIENT never reaches these routes.
// - The CLIENT-facing by-id path is POST /proposals/:id/respond (proposal.routes.ts:186,
//   authorize("CLIENT")), whose controller (proposal.controller.ts:23-33) calls
//   proposalService.getByIdForClient(id, clientId) -> proposalRepository.findByIdForClient, a
//   REAL where: { id, clientId } query (the actual analog of what this file used to fake with
//   companyId) plus an explicit ownership check before any mutation.
//
// This test imports and calls the real proposalRepository.findByIdForClient and
// proposalService.getByIdForClient — not a reimplementation — against a real database, proving a
// CLIENT cannot read another client's proposal by direct id, on the exact code path
// respondToProposal (accept/reject) depends on.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let proposalRepository: typeof import("../src/repositories/proposal.repository.js").proposalRepository;
let proposalService: typeof import("../src/services/proposal.service.js").proposalService;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdProposalIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ proposalRepository } = await import("../src/repositories/proposal.repository.js"));
    ({ proposalService } = await import("../src/services/proposal.service.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

describe("proposalRepository/proposalService: CLIENT cross-client IDOR protection (SEC-179)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("findByIdForClient returns null when the proposal belongs to a different client", async () => {
    const owner = await prisma.client.create({ data: { name: `sec179-owner-${Date.now()}` } });
    createdClientIds.push(owner.id);
    const attacker = await prisma.client.create({ data: { name: `sec179-attacker-${Date.now()}` } });
    createdClientIds.push(attacker.id);
    const proposal = await prisma.proposal.create({
      data: { title: "SEC-179 proposal", clientId: owner.id, status: "SENT" },
    });
    createdProposalIds.push(proposal.id);

    const asAttacker = await proposalRepository.findByIdForClient(proposal.id, attacker.id);
    assert.equal(asAttacker, null, "a client must never be able to read another client's proposal by direct id");

    const asOwner = await proposalRepository.findByIdForClient(proposal.id, owner.id);
    assert.ok(asOwner, "the owning client must still be able to read their own proposal");
    assert.equal(asOwner!.id, proposal.id);
  });

  test("proposalService.getByIdForClient (the real code respondToProposal depends on) enforces the same isolation", async () => {
    const owner = await prisma.client.create({ data: { name: `sec179-svc-owner-${Date.now()}` } });
    createdClientIds.push(owner.id);
    const attacker = await prisma.client.create({ data: { name: `sec179-svc-attacker-${Date.now()}` } });
    createdClientIds.push(attacker.id);
    const proposal = await prisma.proposal.create({
      data: { title: "SEC-179 service proposal", clientId: owner.id, status: "SENT" },
    });
    createdProposalIds.push(proposal.id);

    const asAttacker = await proposalService.getByIdForClient(proposal.id, attacker.id);
    assert.equal(asAttacker, null, "cross-client read must return null, the exact condition respondToProposal checks before mutating");
  });
});
