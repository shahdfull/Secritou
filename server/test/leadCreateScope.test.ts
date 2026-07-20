// SEC-102: a lead created via the manual "Add lead" form (leadBaseSchema exposes no serviceId
// or assignedManagerId) never had either field set, unlike a lead created via the public contact
// form (contact.service.ts, which resolves serviceId via serviceService.resolveServiceIdForType).
// leadRepository.buildWhere scopes a MANAGER on `OR: [{serviceId}, {assignedManagerId}]` — a lead
// with neither set matched neither branch, making it invisible to every MANAGER (visible only to
// an unscoped ADMIN). leadService.createLead now defaults a MANAGER-created lead's serviceId to
// the manager's own pole and assignedManagerId to the manager themself.
//
// This test imports and calls the real leadService/leadRepository against a real database — not
// a reimplementation — proving a MANAGER can find their own manually-created lead afterwards.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let leadService: typeof import("../src/services/lead.service.js").leadService;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdLeadIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ leadService } = await import("../src/services/lead.service.js"));
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
});

describe(
  "leadService.createLead — pole scope on manual creation (SEC-102)",
  { skip: !dbAvailable ? "no reachable database" : false },
  () => {
    test("a lead created by a MANAGER gets that manager's serviceId/assignedManagerId, and appears in their own list", async () => {
      const managerUser = await prisma.user.create({
        data: {
          email: `sec102-mgr-${Date.now()}@test.local`,
          name: "Manager A",
          passwordHash: "x",
          role: "MANAGER",
          serviceId: serviceA,
        },
      });

      const lead = await leadService.createLead(
        { name: "SEC-102 manual lead" },
        { userRole: "MANAGER", userServiceId: serviceA, userId: managerUser.id }
      );
      createdLeadIds.push(lead.id);

      assert.equal(lead.serviceId, serviceA, "the lead must inherit the creating manager's pole");
      assert.equal(lead.assignedManagerId, managerUser.id, "the lead must be assigned to its creating manager");

      const ownList = await leadService.getLeads(
        { page: 1, pageSize: 50 },
        { userRole: "MANAGER", userServiceId: serviceA, userId: managerUser.id }
      );
      assert.ok(ownList.data.some((l) => l.id === lead.id), "the manager must see their own manually-created lead");

      const otherPoleList = await leadService.getLeads(
        { page: 1, pageSize: 50 },
        { userRole: "MANAGER", userServiceId: serviceB, userId: "some-other-manager" }
      );
      assert.ok(!otherPoleList.data.some((l) => l.id === lead.id), "a manager from another pole must not see it");

      await prisma.user.delete({ where: { id: managerUser.id } });
    });

    test("a lead created by an ADMIN keeps no service/manager assignment (matches prior behavior)", async () => {
      const lead = await leadService.createLead({ name: "SEC-102 admin lead" }, { userRole: "ADMIN" });
      createdLeadIds.push(lead.id);

      assert.equal(lead.serviceId, null);
      assert.equal(lead.assignedManagerId, null);
    });
  }
);
