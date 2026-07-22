// Tests for the Lead↔Service bridge (pure logic, no DB) and the real leadService pole scoping
// against a real database (SEC-100 — the pole-isolation half of this file used to reimplement a
// `serviceFilter` locally that only checked `{ serviceId }`, missing the real buildWhere's
// `assignedManagerId` OR branch entirely — it would stay green even if that branch broke).

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { serviceNameForType } from "../src/constants/serviceMapping.js";

describe("serviceMapping.serviceNameForType", () => {
  test("maps each canonical serviceType to the matching pole name", () => {
    assert.equal(serviceNameForType("Management & Performance"), "Management & Performance");
    assert.equal(serviceNameForType("Croissance digitale"), "Croissance digitale");
    assert.equal(serviceNameForType("Technologie"), "Technologie");
    assert.equal(serviceNameForType("IA & Automatisation"), "IA & Automatisation");
  });

  test("'Other' maps to null (unassigned, ADMIN triage)", () => {
    assert.equal(serviceNameForType("Other"), null);
  });

  test("an unknown serviceType maps to null", () => {
    assert.equal(serviceNameForType("Something Else"), null);
  });
});

let prisma: typeof import("../src/config/prisma.js").prisma;
let leadService: typeof import("../src/services/lead.service.js").leadService;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdLeadIds: string[] = [];
const createdUserIds: string[] = [];

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
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("leadService.getLeads — real MANAGER pole isolation (SEC-100)", () => {
    test("an ADMIN sees leads across every pole", async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const leadA = await prisma.lead.create({ data: { name: "sec100-svc admin sees A", serviceId: serviceA } });
      const leadB = await prisma.lead.create({ data: { name: "sec100-svc admin sees B", serviceId: serviceB } });
      createdLeadIds.push(leadA.id, leadB.id);

      const result = await leadService.getLeads({ page: 1, pageSize: 50, orderDir: "desc" }, { userRole: "ADMIN" });
      assert.ok(result.data.some((l) => l.id === leadA.id) && result.data.some((l) => l.id === leadB.id));
    });

    test("a MANAGER with a pole only sees leads in that pole", async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const ownLead = await prisma.lead.create({ data: { name: "sec100-svc own pole", serviceId: serviceA } });
      const otherLead = await prisma.lead.create({ data: { name: "sec100-svc other pole", serviceId: serviceB } });
      createdLeadIds.push(ownLead.id, otherLead.id);

      const result = await leadService.getLeads({ page: 1, pageSize: 50, orderDir: "desc" }, { userRole: "MANAGER", userServiceId: serviceA });
      assert.ok(result.data.some((l) => l.id === ownLead.id));
      assert.ok(!result.data.some((l) => l.id === otherLead.id));
    });

    test("a MANAGER also sees a lead assigned directly to them, even outside their own pole", async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const managerUser = await prisma.user.create({
        data: { email: `sec100-svc-mgr-${Date.now()}@test.local`, name: "Manager B2", passwordHash: "x", role: "MANAGER", serviceId: serviceB },
      });
      createdUserIds.push(managerUser.id);
      const assignedLead = await prisma.lead.create({ data: { name: "sec100-svc assigned cross-pole", serviceId: serviceA, assignedManagerId: managerUser.id } });
      createdLeadIds.push(assignedLead.id);

      const result = await leadService.getLeads({ page: 1, pageSize: 50, orderDir: "desc" }, { userRole: "MANAGER", userServiceId: serviceB, userId: managerUser.id });
      assert.ok(result.data.some((l) => l.id === assignedLead.id), "assignedManagerId must grant visibility regardless of serviceId");
    });

    test("a MANAGER with no service (userServiceId: null) matches nothing by serviceId, not the whole company", async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const lead = await prisma.lead.create({ data: { name: "sec100-svc no-service manager", serviceId: serviceA } });
      createdLeadIds.push(lead.id);

      const result = await leadService.getLeads({ page: 1, pageSize: 50, orderDir: "desc" }, { userRole: "MANAGER", userServiceId: null });
      assert.ok(!result.data.some((l) => l.id === lead.id), "a MANAGER with no pole must not fall back to seeing every lead");
    });
});
