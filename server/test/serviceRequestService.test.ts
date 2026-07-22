// serviceRequest.service.ts had zero test coverage (0% function coverage in the c8 report) despite
// carrying two of the same risk classes CLAUDE.md's Project/Task scoping checklist calls out:
// a MANAGER serviceId scope guard (via the client's own projects, not a serviceId field on
// ServiceRequest itself) and a status state machine (ALLOWED_TRANSITIONS) enforced only in
// adminUpdateServiceRequest. This imports and calls the real service, not a reimplementation.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

let prisma: typeof import("../src/config/prisma.js").prisma;
let serviceRequestService: typeof import("../src/services/serviceRequest.service.js").serviceRequestService;
let dbAvailable = true;

let serviceIdA: string;
let serviceIdB: string;
let actorUserId: string;
const createdUserIds: string[] = [];
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdRequestIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ serviceRequestService } = await import("../src/services/serviceRequest.service.js"));
    await prisma.$queryRaw`SELECT 1`;
    const services = await prisma.service.findMany({ take: 2 });
    if (services.length < 2) throw new Error("need at least 2 seeded Service rows");
    serviceIdA = services[0].id;
    serviceIdB = services[1].id;
    // ServiceRequestHistory.userId carries a real FK constraint — a placeholder string like
    // "system" fails INSERT silently inside adminUpdateServiceRequest's fire-and-forget
    // Promise.all(historyPromises), which would otherwise mask itself as a hang under a test
    // runner that doesn't surface unhandled rejections until teardown.
    const actor = await prisma.user.create({
      data: { email: `sr-test-actor-${Date.now()}@example.com`, name: "SR test actor", passwordHash: "x", role: "ADMIN" },
    });
    createdUserIds.push(actor.id);
    actorUserId = actor.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.serviceRequestHistory.deleteMany({ where: { serviceRequestId: { in: createdRequestIds } } });
  await prisma.serviceRequestComment.deleteMany({ where: { serviceRequestId: { in: createdRequestIds } } });
  await prisma.serviceRequest.deleteMany({ where: { id: { in: createdRequestIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

// A client only falls into a manager's scope via a Project it has in that manager's service —
// ServiceRequest itself carries no serviceId column (see serviceRequest.repository.ts#findById).
async function makeClientWithProject(namePrefix: string, serviceId: string) {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client` } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: `${namePrefix} project`, clientId: client.id, serviceId } });
  createdProjectIds.push(project.id);
  return client;
}

async function makeRequest(clientId: string, title: string) {
  const req = await serviceRequestService.createServiceRequest({ title, clientId });
  createdRequestIds.push(req.id);
  return req;
}

describe("serviceRequestService MANAGER scoping (real code, not a reimplementation)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("a manager can read a service request whose client has a project in the manager's service", async () => {
    const client = await makeClientWithProject("scope-read-ok", serviceIdA);
    const req = await makeRequest(client.id, "scope read ok");

    const found = await serviceRequestService.getServiceRequestById(req.id, { userRole: "MANAGER", userServiceId: serviceIdA });
    assert.equal(found.id, req.id);
  });

  test("a manager cannot read a service request whose client has no project in the manager's service (404, not leaked)", async () => {
    const client = await makeClientWithProject("scope-read-blocked", serviceIdA);
    const req = await makeRequest(client.id, "scope read blocked");

    await assert.rejects(
      () => serviceRequestService.getServiceRequestById(req.id, { userRole: "MANAGER", userServiceId: serviceIdB }),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  test("a manager with no serviceId assigned is scoped to nothing (cannot read any service request)", async () => {
    const client = await makeClientWithProject("scope-no-service", serviceIdA);
    const req = await makeRequest(client.id, "scope no service");

    await assert.rejects(
      () => serviceRequestService.getServiceRequestById(req.id, { userRole: "MANAGER", userServiceId: null }),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  test("deleteServiceRequest enforces the same scope as getServiceRequestById, not just the read path", async () => {
    const client = await makeClientWithProject("scope-delete-blocked", serviceIdA);
    const req = await makeRequest(client.id, "scope delete blocked");

    await assert.rejects(
      () => serviceRequestService.deleteServiceRequest(req.id, { userRole: "MANAGER", userServiceId: serviceIdB }),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 404);
        return true;
      }
    );

    const stillThere = await prisma.serviceRequest.findUnique({ where: { id: req.id } });
    assert.ok(stillThere, "a scope-blocked delete must not actually delete the row");
  });

  test("an ADMIN (no scope) can read across services", async () => {
    const client = await makeClientWithProject("scope-admin", serviceIdB);
    const req = await makeRequest(client.id, "scope admin");

    const found = await serviceRequestService.getServiceRequestById(req.id, { userRole: "ADMIN" });
    assert.equal(found.id, req.id);
  });
});

describe("serviceRequestService.adminUpdateServiceRequest status transitions (real code, not a reimplementation)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("allows a valid transition (NEW -> IN_REVIEW) and records history", async () => {
    const client = await makeClientWithProject("transition-valid", serviceIdA);
    const req = await makeRequest(client.id, "transition valid");

    const updated = await serviceRequestService.adminUpdateServiceRequest(req.id, actorUserId, { status: "IN_REVIEW" });
    assert.equal(updated.status, "IN_REVIEW");

    const history = await prisma.serviceRequestHistory.findMany({ where: { serviceRequestId: req.id, field: "status" } });
    assert.equal(history.length, 1);
    assert.equal(history[0].oldValue, "NEW");
    assert.equal(history[0].newValue, "IN_REVIEW");
  });

  test("rejects an invalid transition (NEW -> COMPLETED, skipping the workflow) with 422", async () => {
    const client = await makeClientWithProject("transition-invalid", serviceIdA);
    const req = await makeRequest(client.id, "transition invalid");

    await assert.rejects(
      () => serviceRequestService.adminUpdateServiceRequest(req.id, actorUserId, { status: "COMPLETED" }),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 422);
        return true;
      }
    );

    const stillNew = await prisma.serviceRequest.findUnique({ where: { id: req.id } });
    assert.equal(stillNew?.status, "NEW", "a rejected transition must not partially apply");
  });

  test("rejects any transition out of a terminal status (COMPLETED -> IN_PROGRESS)", async () => {
    const client = await makeClientWithProject("transition-terminal", serviceIdA);
    const req = await makeRequest(client.id, "transition terminal");
    await serviceRequestService.adminUpdateServiceRequest(req.id, actorUserId, { status: "IN_REVIEW" });
    await serviceRequestService.adminUpdateServiceRequest(req.id, actorUserId, { status: "IN_PROGRESS" });
    await serviceRequestService.adminUpdateServiceRequest(req.id, actorUserId, { status: "COMPLETED" });

    await assert.rejects(
      () => serviceRequestService.adminUpdateServiceRequest(req.id, actorUserId, { status: "IN_PROGRESS" }),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 422);
        return true;
      }
    );
  });

  test("rejects an attempt to change type (immutable after creation) with SERVICE_REQUEST_TYPE_IMMUTABLE", async () => {
    const client = await makeClientWithProject("transition-type", serviceIdA);
    const req = await makeRequest(client.id, "transition type");

    await assert.rejects(
      () => serviceRequestService.adminUpdateServiceRequest(req.id, actorUserId, { type: "SUPPORT" } as never),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "SERVICE_REQUEST_TYPE_IMMUTABLE");
        return true;
      }
    );
  });
});
