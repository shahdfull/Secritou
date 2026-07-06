import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { CONTACT_SERVICE_TYPES, CONTACT_BUDGET_OPTIONS } from "./contactForm.js";

// These values are persisted verbatim in ContactRequest/Lead rows and
// embedded in notification emails — this test exists purely to catch an
// accidental edit, not to validate behavior (audit 03 #9).
describe("contact form enums are frozen (audit 03 #9)", () => {
  test("CONTACT_SERVICE_TYPES matches the exact persisted values", () => {
    assert.deepEqual(CONTACT_SERVICE_TYPES, [
      "Business Performance",
      "Digital Growth",
      "Technology Solutions",
      "AI & Automation",
      "Other",
    ]);
  });

  test("CONTACT_BUDGET_OPTIONS matches the exact persisted values", () => {
    assert.deepEqual(CONTACT_BUDGET_OPTIONS, [
      "< 1 000 DT",
      "1 000–5 000 DT",
      "5 000–15 000 DT",
      "+15 000 DT",
    ]);
  });
});
