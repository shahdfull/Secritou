// SEC-018: updateLeadSchema (server/src/validators/lead.validator.ts) used to override the
// shared enum-based status schema with a literal fixed to "NEW" — every transition other than
// NEW was rejected at the validator, before leadService.updateLead's real transition guard
// (LEAD_NEXT_STATUSES) ever ran. Regression introduced by commit e26574f (2026-07-21), never
// covered by a test.

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { updateLeadSchema } from "../src/validators/lead.validator.js";

const ALL_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"];

describe("updateLeadSchema accepts every real LeadStatus value (SEC-018)", () => {
  for (const status of ALL_STATUSES) {
    test(`status: "${status}" passes validation`, () => {
      const result = updateLeadSchema.safeParse({
        body: { status },
        params: { id: "00000000-0000-0000-0000-000000000000" },
      });
      assert.equal(result.success, true, `status "${status}" must be accepted by updateLeadSchema`);
    });
  }

  test("an invalid status string is still rejected", () => {
    const result = updateLeadSchema.safeParse({
      body: { status: "NOT_A_REAL_STATUS" },
      params: { id: "00000000-0000-0000-0000-000000000000" },
    });
    assert.equal(result.success, false, "an unknown status value must still be rejected");
  });
});
