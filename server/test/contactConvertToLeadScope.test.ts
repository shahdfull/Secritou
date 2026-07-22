// SEC-123: contactService.convertToLead accepted assignedManagerId/department as free-form input
// straight from the request body, with no check against the calling MANAGER's own pole — the
// converted Lead never even got a serviceId written (only department, a free-text display field
// with no bearing on leadRepository.buildWhere's scope filter). A MANAGER could therefore convert
// a ContactRequest into a Lead assigned to another pole entirely, or one invisible to any MANAGER
// at all (same underlying defect class as SEC-102, distinct call path). Fixed the same way
// SEC-102 fixed leadService.createLead: a MANAGER's own serviceId/userId always overrides
// whatever the caller passed; ADMIN (unscoped) stays free to assign either.
//
// This test imports and calls the real contactService.convertToLead against a real database —
// not a reimplementation — proving a MANAGER's own pole always wins.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let ContactService: typeof import("../src/services/contact.service.js").ContactService;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdLeadIds: string[] = [];
const createdContactRequestIds: string[] = [];
const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ ContactService } = await import("../src/services/contact.service.js"));
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
  await prisma.contactRequest.deleteMany({ where: { id: { in: createdContactRequestIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function makeContactRequest() {
  const cr = await prisma.contactRequest.create({
    data: { name: "SEC-123 contact", email: `sec123-${Date.now()}@test.local`, serviceType: "Technologie", company: "Test SARL", message: "Test message" },
  });
  createdContactRequestIds.push(cr.id);
  return cr;
}

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("contactService.convertToLead — pole scope enforced (SEC-123)", () => {
    test("a MANAGER's own pole always wins, even if the caller passed another pole's department/manager", async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const contactService = new ContactService();
      const managerUser = await prisma.user.create({
        data: { email: `sec123-mgr-${Date.now()}@test.local`, name: "Manager A", passwordHash: "x", role: "MANAGER", serviceId: serviceA },
      });
      createdUserIds.push(managerUser.id);
      const otherManager = await prisma.user.create({
        data: { email: `sec123-other-${Date.now()}@test.local`, name: "Manager B", passwordHash: "x", role: "MANAGER", serviceId: serviceB },
      });
      createdUserIds.push(otherManager.id);
      const cr = await makeContactRequest();

      // Caller (pole A manager) tries to assign the converted lead to pole B / another manager.
      const lead = await contactService.convertToLead(cr.id, otherManager.id, "some other pole label", {
        userRole: "MANAGER",
        userServiceId: serviceA,
        userId: managerUser.id,
      });
      createdLeadIds.push(lead.id);

      assert.equal(lead.serviceId, serviceA, "the lead must be forced to the calling manager's own pole");
      assert.equal(lead.assignedManagerId, managerUser.id, "the lead must be forced to the calling manager themself");
    });

    test("an ADMIN (unscoped) can freely assign department/manager as passed", async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const contactService = new ContactService();
      const targetManager = await prisma.user.create({
        data: { email: `sec123-admin-target-${Date.now()}@test.local`, name: "Manager C", passwordHash: "x", role: "MANAGER", serviceId: serviceB },
      });
      createdUserIds.push(targetManager.id);
      const cr = await makeContactRequest();

      const lead = await contactService.convertToLead(cr.id, targetManager.id, undefined, { userRole: "ADMIN" });
      createdLeadIds.push(lead.id);

      assert.equal(lead.assignedManagerId, targetManager.id, "ADMIN's explicit assignment must be respected");
    });
  }
);
