// Tests for task access scoping (RBAC fix) : pure logic, no DB.
// Mirrors the project filter in task.repository.buildWhere and assertProjectInScope.

import test, { describe } from "node:test";
import assert from "node:assert/strict";

type Role = "ADMIN" | "MANAGER" | "FREELANCER" | "CLIENT";

// Mirrors the project filter applied to task queries for each role.
function projectFilter(companyId: string, role: Role, serviceId?: string | null) {
  return role === "MANAGER"
    ? { companyId, serviceId: serviceId ?? "__none__" }
    : { companyId };
}

describe("task read scope by role", () => {
  test("ADMIN is unscoped within the company", () => {
    assert.deepEqual(projectFilter("co-1", "ADMIN"), { companyId: "co-1" });
  });

  test("MANAGER is scoped to their service", () => {
    assert.deepEqual(projectFilter("co-1", "MANAGER", "svc-1"), { companyId: "co-1", serviceId: "svc-1" });
  });

  test("MANAGER without a service matches nothing", () => {
    assert.deepEqual(projectFilter("co-1", "MANAGER", null), { companyId: "co-1", serviceId: "__none__" });
  });
});

// Mirrors assertProjectInScope: a manager may only act on a project in their service.
function isProjectInScope(
  project: { serviceId: string | null },
  scope: { userRole: Role; userServiceId?: string | null }
) {
  if (scope.userRole !== "MANAGER") return true; // ADMIN: unrestricted
  return project.serviceId === (scope.userServiceId ?? "__none__");
}

describe("task write scope (assertProjectInScope)", () => {
  test("ADMIN may act on any project", () => {
    assert.equal(isProjectInScope({ serviceId: "svc-2" }, { userRole: "ADMIN" }), true);
  });

  test("MANAGER may act on a project in their service", () => {
    assert.equal(isProjectInScope({ serviceId: "svc-1" }, { userRole: "MANAGER", userServiceId: "svc-1" }), true);
  });

  test("MANAGER may NOT act on a project of another service", () => {
    assert.equal(isProjectInScope({ serviceId: "svc-2" }, { userRole: "MANAGER", userServiceId: "svc-1" }), false);
  });

  test("MANAGER with no service may NOT act on a serviced project", () => {
    assert.equal(isProjectInScope({ serviceId: "svc-1" }, { userRole: "MANAGER", userServiceId: null }), false);
  });
});
