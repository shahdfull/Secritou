// SEC-028: gscConnectionService (startConnect/getStatus/disconnect/completeConnect) never
// checked the MANAGER-own-pole scope already applied to clientRepository.findById elsewhere
// (where.projects.some.serviceId) — a MANAGER could connect/read/disconnect Search Console for
// any client company-wide, regardless of pole.
//
// This test imports and calls the real gscConnectionService against a real database — not a
// reimplementation — confirming a pole-A Manager is refused access to a pole-B client's Search
// Console connection, while a same-pole Manager and an ADMIN (unscoped) still succeed.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

let prisma: typeof import("../src/config/prisma.js").prisma;
let gscConnectionService: typeof import("../src/services/gscConnection.service.js").gscConnectionService;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ gscConnectionService } = await import("../src/services/gscConnection.service.js"));
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
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeClientInPole(serviceId: string, namePrefix: string) {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client`, serviceId } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: `${namePrefix} project`, clientId: client.id, serviceId } });
  createdProjectIds.push(project.id);
  return client;
}

describe("SEC-028: gscConnectionService enforces Manager pole scope", () => {
  // startConnect's success path (buildState -> HMAC signing) requires
  // INTEGRATIONS_ENCRYPTION_KEY, which isn't configured in this test environment — only the
  // scope-rejection path (which throws before reaching buildState) is testable here without it.
  test("a pole-A Manager cannot start a GSC connection for a pole-B client", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await makeClientInPole(serviceB, "sec028-start-b");

    await assert.rejects(
      () => gscConnectionService.startConnect(client.id, "initiator-id", { userRole: "MANAGER", userServiceId: serviceA }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 404
    );
  });

  test("a pole-A Manager cannot read GSC status for a pole-B client", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await makeClientInPole(serviceB, "sec028-status-b");

    await assert.rejects(
      () => gscConnectionService.getStatus(client.id, { userRole: "MANAGER", userServiceId: serviceA }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 404
    );
  });

  test("a same-pole Manager can read GSC status (not connected)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await makeClientInPole(serviceA, "sec028-status-a");

    const status = await gscConnectionService.getStatus(client.id, { userRole: "MANAGER", userServiceId: serviceA });
    assert.equal(status.connected, false);
  });

  test("a pole-A Manager cannot disconnect GSC for a pole-B client", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await makeClientInPole(serviceB, "sec028-disconnect-b");

    await assert.rejects(
      () => gscConnectionService.disconnect(client.id, { userRole: "MANAGER", userServiceId: serviceA }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 404
    );
  });

  test("an ADMIN (unscoped) can read GSC status for a client from any pole", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await makeClientInPole(serviceB, "sec028-admin-b");

    const status = await gscConnectionService.getStatus(client.id, { userRole: "ADMIN" });
    assert.equal(status.connected, false);
  });
});
