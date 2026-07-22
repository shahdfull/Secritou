// SEC-177: projectService.clientApprove's preread (status !== REVIEW, clientApprovedAt already
// set) ran outside the transaction and was never re-checked inside prisma.$transaction — unlike
// the openTasks/deposit/unresolvedApprovals guards, which explicitly re-read via tx for exactly
// this reason (comment at project.service.ts:341-344: "the preread checks above ran outside it
// [...] the project could complete despite one of these conditions no longer holding"). Two
// near-simultaneous calls (double-click, network retry) on the same REVIEW project could both
// pass the preread before either commits, the second silently overwriting clientApprovedAt/
// clientApprovedById with a fresh timestamp. Fixed by re-reading status/clientApprovedAt inside
// the same tx, alongside the three existing re-checks, and rejecting a second concurrent call
// with 409 PROJECT_ALREADY_APPROVED.
//
// This test imports and calls the real projectService.clientApprove against a real database —
// not a reimplementation — firing two strictly concurrent calls (Promise.allSettled, the same
// model already validated for acceptWithCascade/createLead) on the same REVIEW project, and
// confirms clientApprovedAt is never overwritten by a second call.
//
// Requires a real, migrated database; skipped if unreachable.

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

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("projectService.clientApprove under real concurrency (SEC-177)", () => {
  test("two strictly concurrent approvals on the same REVIEW project never both overwrite clientApprovedAt", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: `sec177-client-${Date.now()}`, serviceId } });
    createdClientIds.push(client.id);
    const clientUser = await prisma.user.create({
      data: { email: `sec177-${Date.now()}@example.com`, name: "SEC-177 client user", passwordHash: "x", role: "CLIENT", clientId: client.id },
    });
    createdUserIds.push(clientUser.id);
    const proposal = await prisma.proposal.create({
      data: { title: "SEC-177 proposal", amount: 1000, currency: "TND", status: "ACCEPTED", clientId: client.id },
    });
    createdProposalIds.push(proposal.id);
    const project = await prisma.project.create({
      data: { name: "SEC-177 project", clientId: client.id, serviceId, status: "REVIEW", proposalId: proposal.id },
    });
    createdProjectIds.push(project.id);
    // No deposit invoice, no tasks, no pending approvals — every guard except the one under
    // test passes trivially, isolating the race to status/clientApprovedAt specifically.

    const results = await Promise.allSettled([
      projectService.clientApprove(project.id, client.id, clientUser.id),
      projectService.clientApprove(project.id, client.id, clientUser.id),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    assert.equal(fulfilled.length, 1, `expected exactly 1 of the 2 concurrent approvals to succeed, got ${fulfilled.length}`);

    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    assert.equal(rejected.length, 1);
    assert.equal((rejected[0]!.reason as { code?: string }).code, "PROJECT_ALREADY_APPROVED");

    const finalProject = await prisma.project.findUnique({ where: { id: project.id } });
    assert.equal(finalProject!.status, "COMPLETED");
    assert.ok(finalProject!.clientApprovedAt, "clientApprovedAt must be set exactly once, by whichever call won");
  });
});
