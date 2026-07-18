// RG-004b (REFERENTIEL.md §5) : "À la validation finale du client, une facture de solde est
// générée pour le complément (70% de la proposition)." Only verified by code_grep so far — the
// exact calculation (complement to 100% vs an independent recompute fixed at 70%) had never been
// confirmed by direct line-by-line reading nor by a test that calls the real service. Existing
// tests covering clientApprove (project.clientApprove.test.ts, ratingRequestNotification.test.ts)
// all mirror/reimplement the guard logic locally — none of them import and call the real
// projectService.clientApprove, and none of them assert anything about the balance invoice's
// amount.
//
// Direct reading of project.service.ts#clientApprove (lines 306-308) confirms the real formula
// is a COMPLEMENT TO 100%, not an independent 70% recompute:
//   depositAmount = depositInvoice.amountHT if it exists, else 30% of proposalAmount
//   balanceAmount = proposalAmount - depositAmount
// This is more robust than the rule's literal text suggests: whatever the deposit invoice was
// actually billed for, the balance always makes deposit + balance == the full proposal amount,
// never a fixed 70% that could over- or under-bill if the deposit itself ever deviated from 30%.
//
// This test imports and calls the real projectService.clientApprove against a real database —
// not a reimplementation — and confirms the balance invoice's amountHT is the exact complement
// to the proposal's full amount, both in the nominal 30%-deposit case and in a case where the
// deposit invoice deviates from the usual 30% (proving it's a complement, not an independent
// fixed-rate computation).
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let projectService: typeof import("../src/services/project.service.js").projectService;
let dbAvailable = true;

let serviceId: string;
const createdClientIds: string[] = [];
const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
const createdProposalIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ projectService } = await import("../src/services/project.service.js"));
    await prisma.$queryRaw`SELECT 1`;
    const service = await prisma.service.findFirst();
    if (!service) throw new Error("no Service seeded");
    serviceId = service.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.invoice.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeApprovedProjectWithDeposit(opts: { namePrefix: string; proposalAmount: number; depositAmountHT: number }) {
  const client = await prisma.client.create({ data: { name: `${opts.namePrefix} client`, serviceId } });
  createdClientIds.push(client.id);
  const clientUser = await prisma.user.create({
    data: { email: `${opts.namePrefix}-${Date.now()}@example.com`, name: `${opts.namePrefix} user`, passwordHash: "x", role: "CLIENT", clientId: client.id },
  });
  createdUserIds.push(clientUser.id);
  const proposal = await prisma.proposal.create({
    data: { title: `${opts.namePrefix} proposal`, amount: opts.proposalAmount, currency: "TND", status: "ACCEPTED", clientId: client.id },
  });
  createdProposalIds.push(proposal.id);
  const project = await prisma.project.create({
    data: { name: `${opts.namePrefix} project`, clientId: client.id, serviceId, status: "REVIEW", proposalId: proposal.id },
  });
  createdProjectIds.push(project.id);
  await prisma.invoice.create({
    data: {
      number: `${opts.namePrefix}-DEP-${Date.now()}`,
      title: "Deposit",
      amount: opts.depositAmountHT,
      amountHT: opts.depositAmountHT,
      currency: "TND",
      status: "PAID",
      invoiceType: "DEPOSIT",
      clientId: client.id,
      projectId: project.id,
    },
  });
  return { client, clientUser, project, proposal };
}

describe("projectService.clientApprove — balance invoice amount (RG-004b)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("nominal case: 30% deposit already paid, balance invoice is exactly the complement to 100%", async () => {
    const { client, clientUser, project } = await makeApprovedProjectWithDeposit({ namePrefix: "rg004b-a", proposalAmount: 1000, depositAmountHT: 300 });

    await projectService.clientApprove(project.id, client.id, clientUser.id);

    const balanceInvoice = await prisma.invoice.findFirst({ where: { projectId: project.id, invoiceType: "BALANCE" } });
    assert.ok(balanceInvoice, "a BALANCE invoice must be created on client approval");
    assert.equal(Number(balanceInvoice!.amountHT), 700, "balance must be proposalAmount (1000) - actual deposit (300) = 700");
  });

  test("deposit deviates from the usual 30%: balance is still the exact complement to 100%, not an independent 70% recompute", async () => {
    // Deposit billed at 400 (not the usual 300 for a 1000 proposal) — if the code recomputed an
    // independent fixed 70% (700) instead of complementing the ACTUAL deposit, this would either
    // double-bill (400 + 700 = 1100, more than the proposal) or the discrepancy would go
    // unnoticed. The real formula (proposalAmount - actual depositAmount) must yield 600.
    const { client, clientUser, project } = await makeApprovedProjectWithDeposit({ namePrefix: "rg004b-b", proposalAmount: 1000, depositAmountHT: 400 });

    await projectService.clientApprove(project.id, client.id, clientUser.id);

    const balanceInvoice = await prisma.invoice.findFirst({ where: { projectId: project.id, invoiceType: "BALANCE" } });
    assert.ok(balanceInvoice);
    assert.equal(Number(balanceInvoice!.amountHT), 600, "balance must complement the ACTUAL deposit (1000 - 400 = 600), not recompute an independent fixed 70%");

    const totalBilled = 400 + Number(balanceInvoice!.amountHT);
    assert.equal(totalBilled, 1000, "deposit + balance must always sum to exactly the proposal's full amount, never more, never less");
  });
});
