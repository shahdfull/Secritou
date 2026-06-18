import test from "node:test";
import assert from "node:assert/strict";

class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

// ---------- minimal stubs ----------

function makeRating(overrides = {}) {
  return {
    id: "rating-1",
    score: 4,
    comment: "Great work",
    freelancerId: "f-1",
    missionId: "m-1",
    applicationId: "app-1",
    reviewerId: "rev-1",
    reviewer: { id: "rev-1", name: "Alice" },
    mission: { id: "m-1", title: "Build API" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------- unit tests for business rules ----------

test("score must be between 1 and 5", () => {
  const valid = [1, 2, 3, 4, 5];
  const invalid = [0, 6, -1, 10];

  for (const s of valid) {
    assert.ok(s >= 1 && s <= 5, `${s} should be valid`);
  }
  for (const s of invalid) {
    assert.ok(!(s >= 1 && s <= 5), `${s} should be invalid`);
  }
});

test("average computation", () => {
  const scores = [5, 4, 3, 4, 5];
  const total = scores.reduce((a, b) => a + b, 0);
  const avg = Math.round((total / scores.length) * 10) / 10;
  assert.equal(avg, 4.2);
});

test("average rounds to 1 decimal", () => {
  const scores = [1, 2, 3];
  const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  assert.equal(avg, 2);
});

test("distribution counts correctly", () => {
  const scores = [5, 5, 4, 3, 5];
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const s of scores) dist[s]++;
  assert.equal(dist[5], 3);
  assert.equal(dist[4], 1);
  assert.equal(dist[3], 1);
  assert.equal(dist[2], 0);
  assert.equal(dist[1], 0);
});

test("empty distribution gives averageScore 0", () => {
  const scores: number[] = [];
  const reviewCount = scores.length;
  const averageScore = reviewCount > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / reviewCount) * 10) / 10
    : 0;
  assert.equal(averageScore, 0);
});

test("HttpError is thrown for non-client attempting to rate", () => {
  function checkRole(role: string) {
    if (role !== "ADMIN" && role !== "CLIENT") {
      throw new HttpError(403, "Only clients can rate freelancers");
    }
  }

  assert.throws(() => checkRole("FREELANCER"), (err: any) => {
    assert.equal(err.statusCode, 403);
    return true;
  });

  assert.doesNotThrow(() => checkRole("CLIENT"));
  assert.doesNotThrow(() => checkRole("ADMIN"));
});

test("HttpError is thrown for non-completed mission", () => {
  function checkMissionStatus(status: string) {
    if (status !== "COMPLETED") {
      throw new HttpError(400, "You can only rate freelancers after a mission is completed");
    }
  }

  for (const s of ["OPEN", "ASSIGNED", "IN_PROGRESS", "CANCELLED"]) {
    assert.throws(() => checkMissionStatus(s), (err: any) => {
      assert.equal(err.statusCode, 400);
      return true;
    });
  }

  assert.doesNotThrow(() => checkMissionStatus("COMPLETED"));
});

test("HttpError is thrown when rating already exists", () => {
  function checkDuplicate(existing: unknown) {
    if (existing) {
      throw new HttpError(409, "You have already rated this freelancer for this mission");
    }
  }

  assert.throws(() => checkDuplicate(makeRating()), (err: any) => {
    assert.equal(err.statusCode, 409);
    return true;
  });

  assert.doesNotThrow(() => checkDuplicate(null));
});

test("only reviewer or admin can edit a rating", () => {
  const rating = makeRating({ reviewerId: "user-A" });

  function checkOwnership(userId: string, role: string) {
    if (rating.reviewerId !== userId && role !== "ADMIN") {
      throw new HttpError(403, "You can only edit your own ratings");
    }
  }

  assert.doesNotThrow(() => checkOwnership("user-A", "CLIENT"));
  assert.doesNotThrow(() => checkOwnership("user-B", "ADMIN"));
  assert.throws(() => checkOwnership("user-B", "CLIENT"), (err: any) => {
    assert.equal(err.statusCode, 403);
    return true;
  });
});
