// Tests for delete/archive business guards (P1 #6) — pure logic, no DB.
// Mirrors guards in lead.service.deleteLead and project.service.deleteProject.

import test, { describe } from "node:test";
import assert from "node:assert/strict";

// Mirrors lead.service.deleteLead: a converted lead cannot be deleted.
function assertLeadDeletable(lead: { convertedClientId: string | null }) {
  if (lead.convertedClientId) {
    throw Object.assign(new Error("converted"), { code: "LEAD_ALREADY_CONVERTED", statusCode: 409 });
  }
}

// Mirrors project.service.deleteProject guards.
function assertProjectDeletable(counts: { nonDraftInvoices: number; onboardings: number }) {
  if (counts.nonDraftInvoices > 0) {
    throw Object.assign(new Error("invoices"), { code: "PROJECT_HAS_INVOICES", statusCode: 409 });
  }
  if (counts.onboardings > 0) {
    throw Object.assign(new Error("onboarding"), { code: "PROJECT_HAS_ONBOARDING", statusCode: 409 });
  }
}

describe("lead.service.deleteLead guard (P1 #6)", () => {
  test("allows deleting a non-converted lead", () => {
    assert.doesNotThrow(() => assertLeadDeletable({ convertedClientId: null }));
  });

  test("blocks deleting a converted lead", () => {
    assert.throws(
      () => assertLeadDeletable({ convertedClientId: "client-1" }),
      (e: any) => e.code === "LEAD_ALREADY_CONVERTED" && e.statusCode === 409
    );
  });
});

describe("project.service.deleteProject guards (P1 #6)", () => {
  test("allows deleting a project with no issued invoices and no onboarding", () => {
    assert.doesNotThrow(() => assertProjectDeletable({ nonDraftInvoices: 0, onboardings: 0 }));
  });

  test("blocks deleting a project with issued invoices", () => {
    assert.throws(
      () => assertProjectDeletable({ nonDraftInvoices: 2, onboardings: 0 }),
      (e: any) => e.code === "PROJECT_HAS_INVOICES"
    );
  });

  test("blocks deleting a project with an onboarding record", () => {
    assert.throws(
      () => assertProjectDeletable({ nonDraftInvoices: 0, onboardings: 1 }),
      (e: any) => e.code === "PROJECT_HAS_ONBOARDING"
    );
  });
});
