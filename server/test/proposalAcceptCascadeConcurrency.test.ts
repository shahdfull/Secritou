// SEC-134: proposalService.acceptWithCascade's idempotence guard (`alreadyAccepted =
// proposal.status === "ACCEPTED"`, proposal.service.ts:380) sits inside a default-isolation
// `prisma.$transaction` (READ COMMITTED, no `isolationLevel: "Serializable"`) — unlike
// projectTemplateService.applyToProject's equivalent guard (SEC-073), which explicitly uses
// Serializable so two concurrent callers can never both read status/count as "not yet done"
// before either commits. No test had ever driven two real concurrent acceptWithCascade calls on
// the same proposal to see whether the same protection actually holds here.
//
// This test imports and calls the real proposalService.acceptWithCascade against a real database
// — not a reimplementation — using the exact Promise.allSettled pattern already validated for
// applyToProject in projectTemplateIdempotencyAndFreelancerFields.test.ts, to observe whether the
// missing Serializable isolation lets two concurrent accepts both create a Project/Invoice for
// the same proposal (this test therefore documents the ACTUAL behavior, not necessarily "success"
// — see the note in ANOMALIES.yaml SEC-134 for the two failure shapes this can legitimately take).
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let proposalService: typeof import("../src/services/proposal.service.js").proposalService;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdProposalIds: string[] = [];
const createdProjectIds: string[] = [];
const createdInvoiceIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ proposalService } = await import("../src/services/proposal.service.js"));
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
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

describe("proposalService.acceptWithCascade under real concurrency (SEC-134)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("two strictly concurrent accepts on the same proposal never both produce a Project", async () => {
    const client = await prisma.client.create({ data: { name: "sec134 client" } });
    createdClientIds.push(client.id);
    const proposal = await prisma.proposal.create({
      data: { title: "SEC-134 proposal", clientId: client.id, status: "SENT", amount: 100, currency: "TND" },
    });
    createdProposalIds.push(proposal.id);

    const results = await Promise.allSettled([
      proposalService.acceptWithCascade(proposal.id),
      proposalService.acceptWithCascade(proposal.id),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof proposalService.acceptWithCascade>>>[];
    for (const r of fulfilled) {
      if (r.value.projectId) createdProjectIds.push(r.value.projectId);
      if (r.value.invoiceId) createdInvoiceIds.push(r.value.invoiceId);
    }

    // The property that actually matters: however many calls report "success", the database must
    // never end up with two Project rows (or two deposit Invoice rows) for this one proposal —
    // that's the concrete, observable form "duplicated the cascade" would take.
    const projectCount = await prisma.project.count({ where: { proposalId: proposal.id } });
    const linkedProjects = await prisma.proposal.findUnique({ where: { id: proposal.id }, select: { linkedProject: { select: { id: true } } } });
    assert.equal(projectCount <= 1, true, `expected at most 1 Project for this proposal, found ${projectCount}`);
    assert.ok(linkedProjects, "proposal must still exist");

    if (fulfilled.length > 1) {
      const distinctProjectIds = new Set(fulfilled.map((r) => r.value.projectId).filter(Boolean));
      assert.equal(distinctProjectIds.size, 1, "if both calls report success, they must have produced/returned the SAME project, not two different ones");
    }
  });
});
