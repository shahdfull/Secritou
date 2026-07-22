// SEC-099: assertProposalInScope (and proposalRepository.findAll's serviceId filter) used to key
// off proposal.projectId — the project a proposal is optionally created FROM (relation
// "ProjectProposals"), which is almost always null — instead of linkedProject, the project
// created FROM the proposal once accepted (relation "ProjectProposal"). Since a proposal has no
// projectId at creation (SEC-028's comment on assertProposalCreationInScope says so explicitly),
// this rejected a MANAGER on every proposal of their own for the ENTIRE post-creation lifecycle:
// they could create one (SEC-028), but never list it, read it, update it, send it, accept it, or
// manage its sections again.
//
// This test imports and calls the real proposalService against a real database — not a
// reimplementation — proving a MANAGER can retrieve and act on their own proposals through every
// stage the fix touches: getAll, getById, update, before AND after acceptWithCascade creates the
// linkedProject, while a MANAGER from another pole still gets 404 throughout.
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
const createdProjectIds: string[] = [];
const createdInvoiceIds: string[] = [];

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
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeClient(namePrefix: string) {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client` } });
  createdClientIds.push(client.id);
  return client;
}

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("assertProposalInScope after creation — SEC-099", () => {
    test("a MANAGER can list and read their own proposal (via lead scope) before any project exists", async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const client = await makeClient("sec099-lead");
      const lead = await prisma.lead.create({ data: { name: "Lead A", serviceId: serviceA } });
      createdLeadIds.push(lead.id);

      const proposal = await proposalService.create(
        { title: "SEC-099 own pole via lead", clientId: client.id, leadId: lead.id },
        { userRole: "MANAGER", userServiceId: serviceA }
      );
      createdProposalIds.push(proposal.id);

      const found = await proposalService.getById(proposal.id, { userRole: "MANAGER", userServiceId: serviceA });
      assert.ok(found);
      assert.equal(found!.id, proposal.id);

      const list = await proposalService.getAll(
        { page: 1, pageSize: 50 },
        { userRole: "MANAGER", userServiceId: serviceA }
      );
      assert.ok(list.data.some((p) => p.id === proposal.id), "the manager's own proposal must appear in their own list");
    });

    test("a MANAGER from another pole gets 404 on that same proposal, and it is absent from their list", async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const client = await makeClient("sec099-lead-cross");
      const lead = await prisma.lead.create({ data: { name: "Lead A2", serviceId: serviceA } });
      createdLeadIds.push(lead.id);

      const proposal = await proposalService.create(
        { title: "SEC-099 cross pole read", clientId: client.id, leadId: lead.id },
        { userRole: "MANAGER", userServiceId: serviceA }
      );
      createdProposalIds.push(proposal.id);

      await assert.rejects(
        () => proposalService.getById(proposal.id, { userRole: "MANAGER", userServiceId: serviceB }),
        (err: unknown) => {
          assert.ok(err instanceof HttpError);
          assert.equal((err as InstanceType<typeof HttpError>).statusCode, 404);
          return true;
        }
      );

      const list = await proposalService.getAll(
        { page: 1, pageSize: 50 },
        { userRole: "MANAGER", userServiceId: serviceB }
      );
      assert.ok(!list.data.some((p) => p.id === proposal.id), "a cross-pole proposal must not appear in the other manager's list");
    });

    test("a MANAGER can still read/update their own proposal once acceptWithCascade creates its linkedProject", async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const client = await makeClient("sec099-accepted");
      const proposal = await proposalService.create(
        { title: "SEC-099 accepted", clientId: client.id, amount: 100, currency: "TND" },
        { userRole: "MANAGER", userServiceId: serviceA }
      );
      createdProposalIds.push(proposal.id);
      await proposalService.update(proposal.id, { status: "SENT" }, undefined, { userRole: "MANAGER", userServiceId: serviceA });

      const result = await proposalService.acceptWithCascade(proposal.id);
      createdProjectIds.push(result.projectId!);
      if (result.invoiceId) createdInvoiceIds.push(result.invoiceId);

      // The project created FROM the accepted proposal has no serviceId of its own yet (created
      // with serviceId: null — see proposalService.acceptWithCascade), so the manager who
      // originally owned the proposal must be re-derived some other way once linkedProject
      // exists: assign it to pole A explicitly, mirroring what a real follow-up assignment would do.
      await prisma.project.update({ where: { id: result.projectId! }, data: { serviceId: serviceA } });

      const found = await proposalService.getById(proposal.id, { userRole: "MANAGER", userServiceId: serviceA });
      assert.ok(found, "manager must still see their own proposal after it produced a linkedProject in their pole");

      await assert.rejects(
        () => proposalService.getById(proposal.id, { userRole: "MANAGER", userServiceId: serviceB }),
        (err: unknown) => {
          assert.ok(err instanceof HttpError);
          assert.equal((err as InstanceType<typeof HttpError>).statusCode, 404);
          return true;
        }
      );
    });

    test("a MANAGER cannot read a proposal tied (via client) exclusively to another pole's project, even with no lead", async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const client = await makeClient("sec099-client-cross");
      const project = await prisma.project.create({ data: { name: "Pole B project", clientId: client.id, serviceId: serviceB } });
      createdProjectIds.push(project.id);

      const proposal = await proposalService.create({ title: "SEC-099 via client", clientId: client.id }, { userRole: "ADMIN" });
      createdProposalIds.push(proposal.id);

      await assert.rejects(
        () => proposalService.getById(proposal.id, { userRole: "MANAGER", userServiceId: serviceA }),
        (err: unknown) => {
          assert.ok(err instanceof HttpError);
          assert.equal((err as InstanceType<typeof HttpError>).statusCode, 404);
          return true;
        }
      );
    });
});
