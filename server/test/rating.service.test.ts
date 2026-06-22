// Tests for rating.service business logic — no DB, pure logic stubs.
// Pattern: node:test + assert, identical to invoice.service.test.ts.

import test, { describe } from "node:test";
import assert from "node:assert/strict";

// ─── Replicated logic from rating.service ───────────────────────────────────

function validateScore(score: number): void {
  if (score < 1 || score > 5 || !Number.isInteger(score)) {
    throw new Error("Score must be an integer between 1 and 5");
  }
}

function computeAverageRating(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((acc, s) => acc + s, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ratingService.addRating — score validation", () => {
  test("rejects score below 1", () => {
    assert.throws(() => validateScore(0), /integer between 1 and 5/);
  });

  test("rejects score above 5", () => {
    assert.throws(() => validateScore(6), /integer between 1 and 5/);
  });

  test("rejects non-integer score", () => {
    assert.throws(() => validateScore(3.5), /integer between 1 and 5/);
  });

  test("accepts valid score 1", () => {
    assert.doesNotThrow(() => validateScore(1));
  });

  test("accepts valid score 5", () => {
    assert.doesNotThrow(() => validateScore(5));
  });

  test("accepts valid score 3", () => {
    assert.doesNotThrow(() => validateScore(3));
  });
});

describe("ratingService.updateFreelancerRatingAverage — average computation", () => {
  test("returns null for no ratings", () => {
    assert.strictEqual(computeAverageRating([]), null);
  });

  test("returns score itself for single rating", () => {
    assert.strictEqual(computeAverageRating([4]), 4);
  });

  test("returns correct average for two equal ratings", () => {
    assert.strictEqual(computeAverageRating([3, 3]), 3);
  });

  test("rounds to one decimal place", () => {
    // (1 + 2 + 3) / 3 = 2.0
    assert.strictEqual(computeAverageRating([1, 2, 3]), 2);
  });

  test("rounds half-scores correctly", () => {
    // (1 + 2) / 2 = 1.5 → rounds to 1.5
    assert.strictEqual(computeAverageRating([1, 2]), 1.5);
  });

  test("returns 5 for all max scores", () => {
    assert.strictEqual(computeAverageRating([5, 5, 5]), 5);
  });

  test("returns 1 for all min scores", () => {
    assert.strictEqual(computeAverageRating([1, 1, 1]), 1);
  });

  test("rounds correctly for repeating decimal", () => {
    // (4 + 5 + 5) / 3 = 4.666... → rounds to 4.7
    assert.strictEqual(computeAverageRating([4, 5, 5]), 4.7);
  });
});
