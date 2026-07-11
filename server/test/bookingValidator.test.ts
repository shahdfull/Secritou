import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { bookSlotSchema, createRecurringAvailabilitySchema } from "../src/validators/booking.validator.js";

describe("booking validator", () => {
  test("accepts a public booking payload with a Tunisian phone number", () => {
    const result = bookSlotSchema.parse({
      body: {
        slotId: "slot-1",
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "+21623456789",
        notes: "Looking forward to it",
      },
    });

    assert.equal(result.body.phone, "+21623456789");
  });

  test("rejects an invalid Tunisian phone number", () => {
    assert.throws(() =>
      bookSlotSchema.parse({
        body: {
          slotId: "slot-1",
          name: "Jane Doe",
          email: "jane@example.com",
          phone: "123",
        },
      })
    );
  });

  test("accepts recurring slot generation payloads", () => {
    const result = createRecurringAvailabilitySchema.parse({
      body: {
        startDate: "2026-07-08",
        endDate: "2026-07-12",
        dayStart: "09:00",
        dayEnd: "17:00",
        intervalMinutes: 30,
        weekdaysOnly: true,
      },
    });

    assert.equal(result.body.intervalMinutes, 30);
    assert.equal(result.body.weekdaysOnly, true);
  });
});
