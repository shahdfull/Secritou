// Tests for the recurring meeting cadence used by checkMeetingReminders (ceoAlerts.processor.ts).
// Pure logic, no DB.

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { computeNextOccurrence } from "../src/repositories/projectMeeting.repository.js";

describe("computeNextOccurrence", () => {
  test("NONE never produces a next occurrence", () => {
    assert.equal(computeNextOccurrence(new Date("2026-07-10T00:00:00Z"), "NONE"), null);
  });

  test("WEEKLY advances by 7 days", () => {
    const next = computeNextOccurrence(new Date("2026-07-10T00:00:00Z"), "WEEKLY");
    assert.equal(next?.toISOString().slice(0, 10), "2026-07-17");
  });

  test("BIWEEKLY advances by 14 days", () => {
    const next = computeNextOccurrence(new Date("2026-07-10T00:00:00Z"), "BIWEEKLY");
    assert.equal(next?.toISOString().slice(0, 10), "2026-07-24");
  });

  test("MONTHLY advances by 30 days (not calendar-month aware)", () => {
    const next = computeNextOccurrence(new Date("2026-07-10T00:00:00Z"), "MONTHLY");
    assert.equal(next?.toISOString().slice(0, 10), "2026-08-09");
  });
});
