// Tests for MANAGER pole (service) isolation on analytics and commissions : pure logic, no DB.
// Mirrors the serviceId resolution added to executiveMetrics/healthBoard/revenueForecast/
// clientProfitability/timeEntry (global summary + workload) controllers, and the pre-existing
// self-scoping on commission routes.

import test, { describe } from "node:test";
import assert from "node:assert/strict";

type Role = "ADMIN" | "MANAGER" | "FREELANCER" | "CLIENT";

// Mirrors the `serviceId` resolution repeated in executiveMetrics.controller.ts,
// healthBoard.controller.ts, revenueForecast.controller.ts and clientProfitability.controller.ts:
// a MANAGER is always forced to their own service (or "__none__" if unassigned), and can never
// pick another pole via the ?serviceId= query param. ADMIN is unscoped unless it opts into a filter.
// Also used verbatim by timeEntry.controller.ts's getGlobalTimeSummary and getWorkload.
function resolveAnalyticsServiceId(
  scope: { userRole: Role; userServiceId?: string | null },
  requestedServiceId: string | undefined
): string | undefined {
  return scope.userRole === "MANAGER" ? (scope.userServiceId ?? "__none__") : requestedServiceId;
}

describe("analytics serviceId scope by role", () => {
  test("ADMIN with no filter sees all poles (serviceId undefined)", () => {
    assert.equal(resolveAnalyticsServiceId({ userRole: "ADMIN" }, undefined), undefined);
  });

  test("ADMIN may opt into a single pole via ?serviceId=", () => {
    assert.equal(resolveAnalyticsServiceId({ userRole: "ADMIN" }, "svc-2"), "svc-2");
  });

  test("MANAGER of pole A is always scoped to pole A, ignoring any requested serviceId", () => {
    assert.equal(
      resolveAnalyticsServiceId({ userRole: "MANAGER", userServiceId: "svc-A" }, "svc-B"),
      "svc-A"
    );
  });

  test("MANAGER cannot escape scoping by omitting ?serviceId=", () => {
    assert.equal(
      resolveAnalyticsServiceId({ userRole: "MANAGER", userServiceId: "svc-A" }, undefined),
      "svc-A"
    );
  });

  test("MANAGER with no service assigned matches nothing (__none__), not the whole company", () => {
    assert.equal(
      resolveAnalyticsServiceId({ userRole: "MANAGER", userServiceId: null }, "svc-B"),
      "__none__"
    );
  });
});

// Mirrors the project-scoped filters applied inside executiveMetrics/healthBoard/revenueForecast/
// clientProfitability repositories: once a serviceId is resolved, records tied to a different
// pole's project (or with no project at all, for invoices/proposals) are excluded.
function isRecordInScope(record: { projectServiceId: string | null }, serviceId: string | undefined) {
  if (serviceId === undefined) return true; // unscoped (ADMIN, no filter)
  return record.projectServiceId === serviceId;
}

describe("pole A / pole B data isolation for a scoped MANAGER", () => {
  const managerScope = { userRole: "MANAGER" as Role, userServiceId: "svc-A" };
  const resolvedServiceId = resolveAnalyticsServiceId(managerScope, undefined);

  test("a record belonging to the manager's own pole (A) is visible", () => {
    assert.equal(isRecordInScope({ projectServiceId: "svc-A" }, resolvedServiceId), true);
  });

  test("a record belonging to a different pole (B) is NOT visible", () => {
    assert.equal(isRecordInScope({ projectServiceId: "svc-B" }, resolvedServiceId), false);
  });

  test("a project-less record is NOT visible to a scoped MANAGER", () => {
    assert.equal(isRecordInScope({ projectServiceId: null }, resolvedServiceId), false);
  });

  test("the same records are all visible to an unscoped ADMIN", () => {
    const adminServiceId = resolveAnalyticsServiceId({ userRole: "ADMIN" }, undefined);
    assert.equal(isRecordInScope({ projectServiceId: "svc-A" }, adminServiceId), true);
    assert.equal(isRecordInScope({ projectServiceId: "svc-B" }, adminServiceId), true);
    assert.equal(isRecordInScope({ projectServiceId: null }, adminServiceId), true);
  });
});

// Mirrors commission.routes.ts: everything except /my, /my/summary and /projects/:id/my-split
// sits behind `router.use(authorize("ADMIN"))`, so a MANAGER has no route through which to
// request another partner's (or another pole's) commissions — only their own, forced server-side.
function commissionPartnerIdForRequest(
  scope: { userRole: Role; userId: string },
  route: "my" | "admin-only"
): string | null {
  if (route === "admin-only") {
    return scope.userRole === "ADMIN" ? null /* unscoped: any partnerId */ : "FORBIDDEN";
  }
  // /my* routes force partnerId = req.user.sub regardless of any query param the caller sends.
  return scope.userId;
}

describe("commission self-scoping by role", () => {
  test("ADMIN may query the admin-only summary/list routes (unscoped)", () => {
    assert.equal(commissionPartnerIdForRequest({ userRole: "ADMIN", userId: "admin-1" }, "admin-only"), null);
  });

  test("MANAGER is forbidden from the admin-only summary/list routes", () => {
    assert.equal(commissionPartnerIdForRequest({ userRole: "MANAGER", userId: "mgr-A" }, "admin-only"), "FORBIDDEN");
  });

  test("MANAGER's /my route always resolves to their own userId, never another partner's", () => {
    assert.equal(commissionPartnerIdForRequest({ userRole: "MANAGER", userId: "mgr-A" }, "my"), "mgr-A");
  });
});

// Mirrors executiveMetrics.service.ts's cache key derivation: `${CACHE_KEY_BASE}:${serviceId}`
// when scoped, or the bare base key when unscoped. Two MANAGERs of different poles calling
// /analytics/executive in sequence must never read or overwrite each other's cache entry.
const CACHE_KEY_BASE = "executive:metrics:v1";
function cacheKeyFor(serviceId: string | undefined) {
  return serviceId ? `${CACHE_KEY_BASE}:${serviceId}` : CACHE_KEY_BASE;
}

describe("executive metrics cache key isolation by pole", () => {
  test("an unscoped ADMIN request uses the bare base key", () => {
    assert.equal(cacheKeyFor(undefined), "executive:metrics:v1");
  });

  test("MANAGER of pole A and MANAGER of pole B resolve to different cache keys", () => {
    const keyA = cacheKeyFor(resolveAnalyticsServiceId({ userRole: "MANAGER", userServiceId: "svc-A" }, undefined));
    const keyB = cacheKeyFor(resolveAnalyticsServiceId({ userRole: "MANAGER", userServiceId: "svc-B" }, undefined));
    assert.notEqual(keyA, keyB);
    assert.equal(keyA, "executive:metrics:v1:svc-A");
    assert.equal(keyB, "executive:metrics:v1:svc-B");
  });

  test("the same MANAGER always resolves to the same cache key across requests", () => {
    const first = cacheKeyFor(resolveAnalyticsServiceId({ userRole: "MANAGER", userServiceId: "svc-A" }, undefined));
    const second = cacheKeyFor(resolveAnalyticsServiceId({ userRole: "MANAGER", userServiceId: "svc-A" }, "svc-B"));
    assert.equal(first, second); // second call's ?serviceId=svc-B is ignored, same as the resolved scope
  });
});
