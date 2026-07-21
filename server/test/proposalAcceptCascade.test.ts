// SEC-109: this file used to reimplement acceptWithCascade's transaction body locally (a
// `runCascade` mirror function against in-memory fakes carrying a `companyId` field that doesn't
// exist anywhere in this mono-tenant schema — same defect class as SEC-100/SEC-087). 7 of its 10
// branches were never covered by any file that calls the real service (confirmed by direct
// reading in the audit note): idempotent re-acceptance, invoice-only reconciliation, lead already
// converted to a different client, no-amount proposals, no-leadId proposals, and the two error
// branches (version mismatch, expired). The "invite 409 swallowed" branch this file used to test
// no longer applies to acceptWithCascade at all — the client portal invite moved to
// invoice.service.ts#addPayment under RG-018/SEC-002 (already covered by
// invoicePaymentInviteFailure.test.ts / SEC-188), confirmed by reading the current
// acceptWithCascadeAttempt body: no invite call remains in this function.
//
// This test imports and calls the real proposalService.acceptWithCascade against a real database
// — not a reimplementation — covering the 7 previously-mock-only branches plus the two error
// paths already covered elsewhere in spirit but reproduced here directly against the real
// function for completeness.
//
// uploadedById is deliberately omitted from every call here: passing it triggers
// enqueueDocumentGeneration (BullMQ/Redis), an unrelated side effect this test doesn't need to
// exercise the cascade logic itself.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let proposalService: typeof import("../src/services/proposal.service.js").proposalService;
let HttpError: typeof import("../src/utils/httpError.js").HttpError;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdLeadIds: string[] = [];
const createdProposalIds: string[] = [];
const createdProjectIds: string[] = [];
const createdInvoiceIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ proposalService } = await import("../src/services/proposal.service.js"));
    ({ HttpError } = await import("../src/utils/httpError.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeClient(namePrefix: string) {
  const client = await prisma.client.create({ data: { name: `${namePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } });
  createdClientIds.push(client.id);
  return client;
}

describe("proposalService.acceptWithCascade — real service, 7 previously mock-only branches (SEC-109)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("idempotent: re-accepting an ACCEPTED proposal creates no duplicate project/invoice", async () => {
    const client = await makeClient("sec109-idem");
    const proposal = await prisma.proposal.create({ data: { title: "SEC-109 idempotent", clientId: client.id, status: "SENT", amount: 1000, currency: "TND" } });
    createdProposalIds.push(proposal.id);

    const first = await proposalService.acceptWithCascade(proposal.id);
    if (first.projectId) createdProjectIds.push(first.projectId);
    if (first.invoiceId) createdInvoiceIds.push(first.invoiceId);

    const second = await proposalService.acceptWithCascade(proposal.id);

    assert.equal(second.projectId, first.projectId, "re-acceptance must return the SAME project, not a new one");
    assert.equal(second.invoiceId, first.invoiceId, "re-acceptance must return the SAME invoice, not a new one");
    const projectCount = await prisma.project.count({ where: { proposalId: proposal.id } });
    const invoiceCount = await prisma.invoice.count({ where: { proposalId: proposal.id } });
    assert.equal(projectCount, 1);
    assert.equal(invoiceCount, 1);
  });

  test("reconcile: proposal already ACCEPTED with a project but no invoice — backfills the invoice only", async () => {
    const client = await makeClient("sec109-reconcile");
    const proposal = await prisma.proposal.create({ data: { title: "SEC-109 reconcile", clientId: client.id, status: "ACCEPTED", acceptedAt: new Date(), amount: 800, currency: "TND" } });
    createdProposalIds.push(proposal.id);
    const project = await prisma.project.create({ data: { name: proposal.title, clientId: client.id, status: "PLANNING", proposalId: proposal.id } });
    createdProjectIds.push(project.id);

    const result = await proposalService.acceptWithCascade(proposal.id);
    if (result.invoiceId) createdInvoiceIds.push(result.invoiceId);

    assert.equal(result.projectId, project.id, "must reuse the existing project, not create a second one");
    assert.ok(result.invoiceId, "must backfill the missing invoice");
    const projectCount = await prisma.project.count({ where: { proposalId: proposal.id } });
    assert.equal(projectCount, 1);
  });

  test("no amount: project created, no deposit invoice", async () => {
    const client = await makeClient("sec109-noamount");
    const proposal = await prisma.proposal.create({ data: { title: "SEC-109 no amount", clientId: client.id, status: "SENT", amount: null, currency: "TND" } });
    createdProposalIds.push(proposal.id);

    const result = await proposalService.acceptWithCascade(proposal.id);
    if (result.projectId) createdProjectIds.push(result.projectId);

    assert.ok(result.projectId, "a project must still be created");
    assert.equal(result.invoiceId, null, "no invoice must be created for an amount-less proposal");
  });

  test("no leadId: skips lead update, still creates project + invoice", async () => {
    const client = await makeClient("sec109-nolead");
    const proposal = await prisma.proposal.create({ data: { title: "SEC-109 no lead", clientId: client.id, status: "SENT", amount: 500, currency: "TND", leadId: null } });
    createdProposalIds.push(proposal.id);

    const result = await proposalService.acceptWithCascade(proposal.id);
    if (result.projectId) createdProjectIds.push(result.projectId);
    if (result.invoiceId) createdInvoiceIds.push(result.invoiceId);

    assert.ok(result.projectId);
    assert.ok(result.invoiceId);
  });

  test("lead already converted to a different client: auto-conversion does not overwrite it, but the lead is still marked WON", async () => {
    const otherClient = await makeClient("sec109-lead-other");
    const client = await makeClient("sec109-lead-owner");
    const lead = await prisma.lead.create({ data: { name: "SEC-109 lead", convertedClientId: otherClient.id } });
    createdLeadIds.push(lead.id);
    const proposal = await prisma.proposal.create({ data: { title: "SEC-109 lead conflict", clientId: client.id, status: "SENT", amount: 300, currency: "TND", leadId: lead.id } });
    createdProposalIds.push(proposal.id);

    const result = await proposalService.acceptWithCascade(proposal.id);
    if (result.projectId) createdProjectIds.push(result.projectId);
    if (result.invoiceId) createdInvoiceIds.push(result.invoiceId);

    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    assert.equal(updatedLead!.status, "WON", "the lead must still be marked WON");
    assert.equal(updatedLead!.convertedClientId, otherClient.id, "the existing conversion to another client must not be overwritten");
  });

  test("version mismatch throws PROPOSAL_VERSION_MISMATCH and creates nothing", async () => {
    const client = await makeClient("sec109-version");
    const proposal = await prisma.proposal.create({ data: { title: "SEC-109 version", clientId: client.id, status: "SENT", amount: 200, currency: "TND", version: 3 } });
    createdProposalIds.push(proposal.id);

    await assert.rejects(
      () => proposalService.acceptWithCascade(proposal.id, 1),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "PROPOSAL_VERSION_MISMATCH");
        return true;
      }
    );
    assert.equal(await prisma.project.count({ where: { proposalId: proposal.id } }), 0);
  });

  test("expired proposal throws PROPOSAL_EXPIRED and creates nothing", async () => {
    const client = await makeClient("sec109-expired");
    const proposal = await prisma.proposal.create({ data: { title: "SEC-109 expired", clientId: client.id, status: "SENT", amount: 200, currency: "TND", expiresAt: new Date(Date.now() - 86_400_000) } });
    createdProposalIds.push(proposal.id);

    await assert.rejects(
      () => proposalService.acceptWithCascade(proposal.id),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "PROPOSAL_EXPIRED");
        return true;
      }
    );
    assert.equal(await prisma.project.count({ where: { proposalId: proposal.id } }), 0);
  });
});
