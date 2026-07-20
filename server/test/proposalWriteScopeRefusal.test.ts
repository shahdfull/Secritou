// SEC-125 (ANOMALIES.yaml): proposalService.send, update and addSection all call
// assertProposalInScope (proposal.service.ts:266-312, 627), but proposalScopeAfterCreation.test.ts
// (SEC-099) only exercises getById/getAll/update(status)/acceptWithCascade — send, plain update,
// and addSection specifically were never proven to refuse a cross-pole MANAGER.
//
// This test imports and calls the real proposalService methods — not a reimplementation —
// against a real database, mirroring proposalScopeAfterCreation.test.ts's pattern (a lead scoped
// to pole B, a MANAGER from pole A attempting to act on the resulting proposal).
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

let prisma: typeof import("../src/config/prisma.js").prisma;
let proposalService: typeof import("../src/services/proposal.service.js").proposalService;
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

async function makeProposalInPole(serviceId: string, namePrefix: string) {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client` } });
  createdClientIds.push(client.id);
  const lead = await prisma.lead.create({ data: { name: `${namePrefix} lead`, serviceId } });
  createdLeadIds.push(lead.id);
  const proposal = await proposalService.create(
    { title: `${namePrefix} proposal`, clientId: client.id, leadId: lead.id },
    { userRole: "MANAGER", userServiceId: serviceId }
  );
  createdProposalIds.push(proposal.id);
  return proposal;
}

describe("proposalService write methods enforce Manager pole scope (SEC-125)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("send refuses a cross-pole MANAGER with 404, and does not send the proposal", async () => {
    const proposal = await makeProposalInPole(serviceB, "sec125-send");

    await assert.rejects(
      () => proposalService.send(proposal.id, "manager-a-id", { userRole: "MANAGER", userServiceId: serviceA }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 404
    );

    const unchanged = await prisma.proposal.findUnique({ where: { id: proposal.id } });
    assert.equal(unchanged?.status, "DRAFT", "the refused send must not have applied");
  });

  test("send succeeds for the same-pole MANAGER", async () => {
    const proposal = await makeProposalInPole(serviceA, "sec125-send-own");

    await proposalService.send(proposal.id, "manager-a-id", { userRole: "MANAGER", userServiceId: serviceA });

    const updated = await prisma.proposal.findUnique({ where: { id: proposal.id } });
    assert.equal(updated?.status, "SENT");
  });

  test("update refuses a cross-pole MANAGER with 404, and does not apply the change", async () => {
    const proposal = await makeProposalInPole(serviceB, "sec125-update");

    await assert.rejects(
      () => proposalService.update(proposal.id, { title: "hacked title" }, undefined, { userRole: "MANAGER", userServiceId: serviceA }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 404
    );

    const unchanged = await prisma.proposal.findUnique({ where: { id: proposal.id } });
    assert.equal(unchanged?.title, "sec125-update proposal", "the refused update must not have applied");
  });

  test("update succeeds for the same-pole MANAGER", async () => {
    const proposal = await makeProposalInPole(serviceA, "sec125-update-own");

    const updated = await proposalService.update(proposal.id, { title: "renamed by own-pole manager" }, undefined, { userRole: "MANAGER", userServiceId: serviceA });
    assert.equal(updated?.title, "renamed by own-pole manager");
  });

  test("addSection refuses a cross-pole MANAGER with 404, and does not create the section", async () => {
    const proposal = await makeProposalInPole(serviceB, "sec125-addsection");

    await assert.rejects(
      () => proposalService.addSection(proposal.id, { title: "Injected section", orderIndex: 0 }, { userRole: "MANAGER", userServiceId: serviceA }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 404
    );

    const sections = await prisma.proposalSection.findMany({ where: { proposalId: proposal.id } });
    assert.equal(sections.length, 0, "the refused addSection must not have created a row");
  });

  test("addSection succeeds for the same-pole MANAGER", async () => {
    const proposal = await makeProposalInPole(serviceA, "sec125-addsection-own");

    const section = await proposalService.addSection(proposal.id, { title: "Legit section", orderIndex: 0 }, { userRole: "MANAGER", userServiceId: serviceA });
    assert.equal(section.title, "Legit section");
  });
});
