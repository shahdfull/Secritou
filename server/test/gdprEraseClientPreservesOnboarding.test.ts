// SEC-088: gdprService.eraseClient hard-deleted a Client (tx.client.delete) even when one of its
// Projects had an active ClientOnboarding — ClientOnboarding.client has onDelete: Cascade, so the
// onboarding row was silently deleted before Project's own onDelete: Restrict on onboarding ever
// got a chance to fire (no P2003 is ever raised on this path). Fixed by
// clientRepository.countProjectOnboardings, checked up front alongside the existing invoiceCount
// guard, falling back to anonymize mode instead of a real hard-delete.
//
// This test calls the real gdprService.eraseClient (not a reimplementation) against a real
// database, reproducing the exact scenario from the discovery: a Client with no invoices, a
// Project with an active ClientOnboarding. Requires a real, migrated database; skipped if
// unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let gdprService: typeof import("../src/services/gdpr.service.js").gdprService;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdOnboardingIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ gdprService } = await import("../src/services/gdpr.service.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.clientOnboarding.deleteMany({ where: { id: { in: createdOnboardingIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

describe("gdprService.eraseClient preserves an active ClientOnboarding (SEC-088)", () => {
  test("a client with no invoices but a project with an active onboarding is anonymized, never hard-deleted", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now();
    const client = await prisma.client.create({
      data: { name: `SEC088 client ${uniq}`, email: `sec088-${uniq}@test.local` },
    });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({
      data: { name: `SEC088 project ${uniq}`, clientId: client.id, status: "IN_PROGRESS" },
    });
    createdProjectIds.push(project.id);
    const onboarding = await prisma.clientOnboarding.create({
      data: { projectId: project.id, clientId: client.id },
    });
    createdOnboardingIds.push(onboarding.id);

    const result = await gdprService.eraseClient(client.id, { id: "actor-admin", role: "ADMIN" });
    assert.equal(result.mode, "anonymized", "a client with an active onboarding must never be hard-deleted");

    const clientAfter = await prisma.client.findUnique({ where: { id: client.id } });
    assert.notEqual(clientAfter, null, "the Client row itself must still exist (anonymized, not deleted)");
    assert.notEqual(clientAfter?.name, `SEC088 client ${uniq}`, "the name must have been anonymized");

    const projectAfter = await prisma.project.findUnique({ where: { id: project.id } });
    assert.notEqual(projectAfter, null, "the Project must survive intact");
    assert.equal(projectAfter?.status, "IN_PROGRESS");

    const onboardingAfter = await prisma.clientOnboarding.findUnique({ where: { id: onboarding.id } });
    assert.notEqual(onboardingAfter, null, "the ClientOnboarding must NOT have silently disappeared");
  });
});
