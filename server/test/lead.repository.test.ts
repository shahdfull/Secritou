// SEC-100: this file used to reimplement repositoryUpdate/repositoryDelete/repositoryFindById
// locally, asserting on a `companyId` field that doesn't exist anywhere in this mono-tenant repo
// (CLAUDE.md/SEC-004/SEC-005) — the real lead.repository.ts scopes on `serviceId` +
// `assignedManagerId` (an OR, not a single field). A test asserting on companyId would stay green
// even if the real buildWhere's pole scoping broke entirely.
//
// This test calls the real leadRepository.findById/findAll against a real, migrated database —
// not a reimplementation — proving:
// - a MANAGER cannot read a lead scoped to another pole (findById returns null)
// - a MANAGER CAN read a lead assigned to them directly (assignedManagerId), even if its
//   serviceId belongs to another pole — the real OR branch this repo's earlier version never
//   exercised
// - findById excludes an archived lead by default, and includes it when explicitly requested
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let leadRepository: typeof import("../src/repositories/lead.repository.js").leadRepository;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdLeadIds: string[] = [];
const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ leadRepository } = await import("../src/repositories/lead.repository.js"));
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
  await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

// SEC-195: `{ skip: !dbAvailable }` on describe/test is evaluated SYNCHRONOUSLY when the
// describe/test call itself runs, before the async before() above has any chance to set the
// real value — it worked only by accident of timing locally. Checking `dbAvailable` inside each
// test body (via t.skip()) is the only pattern that actually runs after before() has resolved.
describe("leadRepository.findById/findAll — real pole scoping (SEC-100)", () => {
    test("a MANAGER cannot read a lead scoped to another pole", async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const lead = await prisma.lead.create({ data: { name: "sec100 lead pole B", serviceId: serviceB } });
      createdLeadIds.push(lead.id);

      const result = await leadRepository.findById(lead.id, { userRole: "MANAGER", userServiceId: serviceA });
      assert.equal(result, null, "a lead in another pole must not be readable");
    });

    test("a MANAGER CAN read a lead in their own pole", async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const lead = await prisma.lead.create({ data: { name: "sec100 lead pole A", serviceId: serviceA } });
      createdLeadIds.push(lead.id);

      const result = await leadRepository.findById(lead.id, { userRole: "MANAGER", userServiceId: serviceA });
      assert.ok(result, "a lead in the manager's own pole must be readable");
      assert.equal(result!.id, lead.id);
    });

    test("a MANAGER CAN read a lead assigned to them directly, even if its serviceId is another pole", async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const managerUser = await prisma.user.create({
        data: { email: `sec100-mgr-${Date.now()}@test.local`, name: "Manager B", passwordHash: "x", role: "MANAGER", serviceId: serviceB },
      });
      createdUserIds.push(managerUser.id);
      const lead = await prisma.lead.create({ data: { name: "sec100 lead assigned cross-pole", serviceId: serviceA, assignedManagerId: managerUser.id } });
      createdLeadIds.push(lead.id);

      // This manager's own pole is B, the lead's serviceId is A — only the assignedManagerId
      // branch of the real OR filter can make this readable.
      const result = await leadRepository.findById(lead.id, { userRole: "MANAGER", userServiceId: serviceB, userId: managerUser.id });
      assert.ok(result, "a lead directly assigned to the manager must be readable regardless of its serviceId");
    });

    test("an ADMIN reads any lead regardless of pole", async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const lead = await prisma.lead.create({ data: { name: "sec100 lead admin read", serviceId: serviceB } });
      createdLeadIds.push(lead.id);

      const result = await leadRepository.findById(lead.id, { userRole: "ADMIN" });
      assert.ok(result);
    });

    test("findById excludes an archived lead by default, includes it when explicitly requested", async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const lead = await prisma.lead.create({ data: { name: "sec100 lead archived", serviceId: serviceA, archivedAt: new Date() } });
      createdLeadIds.push(lead.id);

      const hidden = await leadRepository.findById(lead.id, { userRole: "MANAGER", userServiceId: serviceA });
      assert.equal(hidden, null, "an archived lead must not be returned by default");

      const shown = await leadRepository.findById(lead.id, { userRole: "MANAGER", userServiceId: serviceA }, true);
      assert.ok(shown, "an archived lead must be returned when includeArchived is true");
    });

    test("findAll for a MANAGER only returns leads in their pole or assigned to them", async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const ownPoleLead = await prisma.lead.create({ data: { name: "sec100 findAll own pole", serviceId: serviceA } });
      const otherPoleLead = await prisma.lead.create({ data: { name: "sec100 findAll other pole", serviceId: serviceB } });
      createdLeadIds.push(ownPoleLead.id, otherPoleLead.id);

      const result = await leadRepository.findAll(
        { page: 1, pageSize: 50, orderDir: "desc" },
        { userRole: "MANAGER", userServiceId: serviceA }
      );

      assert.ok(result.data.some((l) => l.id === ownPoleLead.id), "own-pole lead must appear in the list");
      assert.ok(!result.data.some((l) => l.id === otherPoleLead.id), "other-pole lead must not appear in the list");
    });
});
