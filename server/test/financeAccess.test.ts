// Tests for finance/proposal access control : pure logic, no DB.
// Mirrors the invoice ADMIN-only gate and assertProposalInScope (manager pole scope).

import test, { describe } from "node:test";
import assert from "node:assert/strict";

type Role = "ADMIN" | "MANAGER" | "FREELANCER" | "CLIENT";

// Invoices/payments are financial: agency-internal, ADMIN only (no MANAGER, no CLIENT staff access).
function canManageInvoices(role: Role) {
  return role === "ADMIN";
}

// Mirrors assertProposalInScope: a MANAGER may only act on a proposal whose project is in their
// service; a proposal with no project is ADMIN-only. ADMIN unrestricted.
function proposalInScope(
  proposal: { projectId: string | null; projectServiceId: string | null },
  scope: { userRole: Role; userServiceId?: string | null }
) {
  if (scope.userRole !== "MANAGER") return true;
  if (!proposal.projectId) return false; // no project → ADMIN only
  return proposal.projectServiceId === (scope.userServiceId ?? "__none__");
}

describe("invoice access : ADMIN only (no financial leak to MANAGER)", () => {
  test("ADMIN may manage invoices", () => {
    assert.equal(canManageInvoices("ADMIN"), true);
  });

  test("MANAGER may NOT manage invoices", () => {
    assert.equal(canManageInvoices("MANAGER"), false);
  });
});

describe("proposal manager scope (via project)", () => {
  test("ADMIN sees any proposal", () => {
    assert.equal(proposalInScope({ projectId: "p1", projectServiceId: "svc-2" }, { userRole: "ADMIN" }), true);
  });

  test("MANAGER sees a proposal whose project is in their service", () => {
    assert.equal(
      proposalInScope({ projectId: "p1", projectServiceId: "svc-1" }, { userRole: "MANAGER", userServiceId: "svc-1" }),
      true
    );
  });

  test("MANAGER does NOT see a proposal of another service", () => {
    assert.equal(
      proposalInScope({ projectId: "p1", projectServiceId: "svc-2" }, { userRole: "MANAGER", userServiceId: "svc-1" }),
      false
    );
  });

  test("MANAGER does NOT see a proposal with no project (ADMIN-only)", () => {
    assert.equal(
      proposalInScope({ projectId: null, projectServiceId: null }, { userRole: "MANAGER", userServiceId: "svc-1" }),
      false
    );
  });
});
