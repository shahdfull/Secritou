// Tests for the Lead↔Service bridge and MANAGER scoping — pure logic, no DB.
// Mirrors constants/serviceMapping.ts and the scope filter in lead.repository.buildWhere.

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { serviceNameForType } from "../src/constants/serviceMapping.js";

describe("serviceMapping.serviceNameForType", () => {
  test("maps each canonical serviceType to the matching pole name", () => {
    assert.equal(serviceNameForType("Business Performance"), "Business Performance");
    assert.equal(serviceNameForType("Digital Growth"), "Digital Growth");
    assert.equal(serviceNameForType("Technology Solutions"), "Technology Solutions");
    assert.equal(serviceNameForType("AI & Automation"), "AI & Automation");
  });

  test("'Other' maps to null (unassigned, ADMIN triage)", () => {
    assert.equal(serviceNameForType("Other"), null);
  });

  test("an unknown serviceType maps to null", () => {
    assert.equal(serviceNameForType("Something Else"), null);
  });
});

// Mirrors the MANAGER service filter in lead.repository.buildWhere.
function serviceFilter(scope: { userRole: string; userServiceId?: string | null }) {
  return scope.userRole === "MANAGER"
    ? { serviceId: scope.userServiceId ?? "__none__" }
    : {};
}

describe("lead scope filter (MANAGER pole isolation)", () => {
  test("ADMIN is unscoped (sees all leads)", () => {
    assert.deepEqual(serviceFilter({ userRole: "ADMIN" }), {});
  });

  test("MANAGER with a service is scoped to that service", () => {
    assert.deepEqual(serviceFilter({ userRole: "MANAGER", userServiceId: "svc-1" }), {
      serviceId: "svc-1",
    });
  });

  test("MANAGER with no service matches nothing (not the whole company)", () => {
    assert.deepEqual(serviceFilter({ userRole: "MANAGER", userServiceId: null }), {
      serviceId: "__none__",
    });
  });
});
