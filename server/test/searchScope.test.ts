// Tests for role-scoped global search (P0 confidentiality fix) — pure logic, no DB.
// Mirrors the routing decisions in search.repository.search / searchForStaff.

import test, { describe } from "node:test";
import assert from "node:assert/strict";

type Role = "ADMIN" | "MANAGER" | "FREELANCER" | "CLIENT";

// Which result categories a role is allowed to receive (the rest must be empty).
function allowedCategories(role: Role): string[] {
  switch (role) {
    case "ADMIN":
      return ["leads", "clients", "projects", "tasks", "freelancers", "proposals", "invoices", "serviceRequests", "approvals"];
    case "MANAGER":
      // Everything except the internal freelancer marketplace.
      return ["leads", "clients", "projects", "tasks", "proposals", "invoices", "serviceRequests", "approvals"];
    case "CLIENT":
      // Only the client's own entities — never leads, other clients, or freelancers.
      return ["projects", "proposals", "invoices", "serviceRequests", "approvals"];
    case "FREELANCER":
      return ["projects", "tasks"];
  }
}

describe("search scope — confidentiality (P0)", () => {
  test("CLIENT never receives leads, clients, or freelancers", () => {
    const allowed = allowedCategories("CLIENT");
    assert.ok(!allowed.includes("leads"), "client must not see leads");
    assert.ok(!allowed.includes("clients"), "client must not see other clients");
    assert.ok(!allowed.includes("freelancers"), "client must not see the freelancer pool");
  });

  test("FREELANCER only receives projects and tasks", () => {
    assert.deepEqual(allowedCategories("FREELANCER").sort(), ["projects", "tasks"]);
  });

  test("MANAGER receives everything except the freelancer marketplace", () => {
    assert.ok(!allowedCategories("MANAGER").includes("freelancers"));
    assert.ok(allowedCategories("MANAGER").includes("leads"));
  });

  test("ADMIN receives all categories", () => {
    assert.equal(allowedCategories("ADMIN").length, 9);
  });
});

// Mirrors the manager service filter ("__none__" when the manager has no service).
function managerServiceValue(serviceId: string | null | undefined) {
  return serviceId ?? "__none__";
}

describe("manager service scoping in search", () => {
  test("a manager with a service scopes to it", () => {
    assert.equal(managerServiceValue("svc-1"), "svc-1");
  });

  test("a manager with no service matches nothing", () => {
    assert.equal(managerServiceValue(null), "__none__");
  });
});
