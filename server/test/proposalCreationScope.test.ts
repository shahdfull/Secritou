// RG-002 (REFERENTIEL.md §5) : "Un Manager (associé) ne peut créer ou modifier un projet que
// dans son propre pôle." Only the Project-level guard (createProject/updateProject forcing
// serviceId) had ever been verified directly. SEC-028 found a real gap while verifying RG-002:
// proposalService.create (called by POST /proposals, the entry point that later produces a
// Project via createProject) had NO pole scope check at all on clientId/leadId/serviceRequestId
// — only role/permission (authorize + requirePermission), never the target's pole. The one
// existing check (proposal.controller.ts's createProposal, projectId branch) only fires when
// req.body.projectId is provided, which almost never happens at creation (the project doesn't
// exist yet). A MANAGER from pole A could therefore create a proposal — and later a project —
// against a Lead/Client tied to pole B.
//
// This test imports and calls the real proposalService.create against a real database — not a
// reimplementation — to prove the fix: a MANAGER cannot create a proposal for a Lead assigned to
// another pole, nor for a Client already exclusively tied to another pole's project(s); both are
// still allowed for their own pole or for a brand-new client with no project at all.
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
const createdProjectIds: string[] = [];
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
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeClient(namePrefix: string) {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client` } });
  createdClientIds.push(client.id);
  return client;
}

describe("proposalService.create — pole scope (RG-002 / SEC-028)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("a MANAGER cannot create a proposal for a Lead assigned to another pole", async () => {
    const client = await makeClient("sec028-lead");
    const lead = await prisma.lead.create({ data: { name: "Lead B", serviceId: serviceB } });
    createdLeadIds.push(lead.id);

    await assert.rejects(
      () =>
        proposalService.create(
          { title: "Cross-pole via lead", clientId: client.id, leadId: lead.id },
          { userRole: "MANAGER", userServiceId: serviceA }
        ),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal((err as InstanceType<typeof HttpError>).statusCode, 404);
        return true;
      }
    );
  });

  test("a MANAGER CAN create a proposal for a Lead assigned to their own pole", async () => {
    const client = await makeClient("sec028-lead-own");
    const lead = await prisma.lead.create({ data: { name: "Lead A", serviceId: serviceA } });
    createdLeadIds.push(lead.id);

    const proposal = await proposalService.create(
      { title: "Same-pole via lead", clientId: client.id, leadId: lead.id },
      { userRole: "MANAGER", userServiceId: serviceA }
    );
    createdProposalIds.push(proposal.id);
    assert.ok(proposal.id);
  });

  test("a MANAGER cannot create a proposal for a Client already tied exclusively to another pole's project", async () => {
    const client = await makeClient("sec028-client");
    const project = await prisma.project.create({ data: { name: "Pole B project", clientId: client.id, serviceId: serviceB } });
    createdProjectIds.push(project.id);

    await assert.rejects(
      () =>
        proposalService.create(
          { title: "Cross-pole via client", clientId: client.id },
          { userRole: "MANAGER", userServiceId: serviceA }
        ),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal((err as InstanceType<typeof HttpError>).statusCode, 404);
        return true;
      }
    );
  });

  test("a MANAGER CAN create a proposal for a brand-new Client with no project at all", async () => {
    const client = await makeClient("sec028-new");

    const proposal = await proposalService.create(
      { title: "New client, no project yet", clientId: client.id },
      { userRole: "MANAGER", userServiceId: serviceA }
    );
    createdProposalIds.push(proposal.id);
    assert.ok(proposal.id);
  });

  test("an ADMIN (no service scope) can create a proposal for any client/lead regardless of pole", async () => {
    const client = await makeClient("sec028-admin");
    const project = await prisma.project.create({ data: { name: "Pole B project (admin test)", clientId: client.id, serviceId: serviceB } });
    createdProjectIds.push(project.id);

    const proposal = await proposalService.create(
      { title: "Admin cross-pole", clientId: client.id },
      { userRole: "ADMIN" }
    );
    createdProposalIds.push(proposal.id);
    assert.ok(proposal.id);
  });
});
