// SEC-125: proposalScopeAfterCreation.test.ts only proved assertProposalInScope's cross-pole
// rejection via getById/getAll/acceptWithCascade — send, update and addSection call the exact
// same guard (proposal.service.ts:268, :312, :601) but were never exercised for a cross-pole
// MANAGER. This closes that specific test gap; the guard itself was already correct.
//
// This test imports and calls the real proposalService against a real database — not a
// reimplementation — proving a pole-B MANAGER is rejected on send/update/addSection for a
// pole-A proposal, while the pole-A manager can still use all three normally.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let proposalService: typeof import("../src/services/proposal.service.js").proposalService;
let HttpError: typeof import("../src/utils/httpError.js").HttpError;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdClientIds: string[] = [];
const createdLeadIds: string[] = [];
const createdProposalIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ proposalService } = await import("../src/services/proposal.service.js"));
    ({ HttpError } = await import("../src/utils/httpError.js"));
    await prisma.$queryRaw`SELECT 1`;
    const services = await prisma.service.findMany({ take: 2 });
    if (services.length < 2) throw new Error("need at least 2 seeded Service rows");
    serviceA = services[0]!.id;
    serviceB = services[1]!.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeProposalInPoleA() {
  const client = await prisma.client.create({ data: { name: "sec125 client" } });
  createdClientIds.push(client.id);
  const lead = await prisma.lead.create({ data: { name: "sec125 lead", serviceId: serviceA } });
  createdLeadIds.push(lead.id);
  const proposal = await proposalService.create(
    { title: "SEC-125 proposal", clientId: client.id, leadId: lead.id },
    { userRole: "MANAGER", userServiceId: serviceA }
  );
  createdProposalIds.push(proposal.id);
  return proposal;
}

function assert404(promise: Promise<unknown>) {
  return assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof HttpError);
    assert.equal((err as InstanceType<typeof HttpError>).statusCode, 404);
    return true;
  });
}

describe(
  "proposalService.send/update/addSection enforce pole scope (SEC-125)",
  { skip: !dbAvailable ? "no reachable database" : false },
  () => {
    test("a pole-B MANAGER is rejected by send/update/addSection on a pole-A proposal", async () => {
      const proposal = await makeProposalInPoleA();
      const poleB = { userRole: "MANAGER" as const, userServiceId: serviceB };

      await assert404(proposalService.send(proposal.id, "someone", poleB));
      await assert404(proposalService.update(proposal.id, { title: "hacked" }, "someone", poleB));
      await assert404(proposalService.addSection(proposal.id, { title: "hacked section", orderIndex: 0 }, poleB));

      const untouched = await prisma.proposal.findUnique({ where: { id: proposal.id } });
      assert.equal(untouched?.status, "DRAFT", "send must not have gone through");
      assert.equal(untouched?.title, "SEC-125 proposal", "update must not have gone through");
    });

    test("the pole-A MANAGER can still use send/update/addSection normally", async () => {
      const proposal = await makeProposalInPoleA();
      const poleA = { userRole: "MANAGER" as const, userServiceId: serviceA };

      const sent = await proposalService.send(proposal.id, "someone", poleA);
      assert.equal(sent?.status, "SENT");

      const section = await proposalService.addSection(proposal.id, { title: "own section", orderIndex: 0 }, poleA);
      assert.equal(section.title, "own section");
    });
  }
);
