// SEC-072: this file used to reimplement rating.service.ts's validateScore/computeAverageRating
// logic locally instead of importing the real module — it would have stayed green even if the
// real service diverged. Rewritten to import and call the real ratingService against a real
// database, BullMQ queue, and (for the n8n alert) a real local HTTP server standing in for n8n.
//
// Also fills the coverage gap identified while comparing the mirror against the real code:
// - the real HttpError(422, ...) on an invalid score, not a generic Error
// - the LOW_RATING_ALERT_THRESHOLD (<=2) notifyN8n escalation, with the real payload
// - the enqueueNotifications fan-out to every ADMIN
// - the real addRating -> updateFreelancerRatingAverage chain (one integration test creates a
//   rating and reads back the freelancer's stored average, rather than testing the two functions
//   in isolation)
//
// SEC-026/SEC-027 pole-scoping is already covered by a real-code test elsewhere
// (freelancerRatingScopeManager.test.ts) and is out of scope here.
//
// Requires a real, migrated database and reachable Redis; skipped otherwise.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";

let prisma: typeof import("../src/config/prisma.js").prisma;
let ratingService: typeof import("../src/services/rating.service.js").ratingService;
let communicationQueue: typeof import("../src/jobs/queues.js").communicationQueue;
let env: typeof import("../src/config/env.js").env;
let HttpError: typeof import("../src/utils/httpError.js").HttpError;
let dbAvailable = true;

const createdUserIds: string[] = [];
const createdFreelancerProfileIds: string[] = [];
const createdRatingIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ ratingService } = await import("../src/services/rating.service.js"));
    ({ communicationQueue } = await import("../src/jobs/queues.js"));
    ({ env } = await import("../src/config/env.js"));
    ({ HttpError } = await import("../src/utils/httpError.js"));
    await prisma.$queryRaw`SELECT 1`;
    await communicationQueue.waitUntilReady();
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.rating.deleteMany({ where: { id: { in: createdRatingIds } } });
  await prisma.freelancerProfile.deleteMany({ where: { id: { in: createdFreelancerProfileIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function makeFreelancerProfile() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const freelancerUser = await prisma.user.create({
    data: { email: `sec072-freelancer-${suffix}@test.local`, name: "SEC-072 Freelancer", passwordHash: "x", role: "FREELANCER" },
  });
  createdUserIds.push(freelancerUser.id);
  const profile = await prisma.freelancerProfile.create({ data: { userId: freelancerUser.id, hourlyRate: "50" } });
  createdFreelancerProfileIds.push(profile.id);
  return profile;
}

describe("ratingService.addRating: score validation (real code)", () => {
  test("rejects a score below 1 with the real HttpError(422)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const profile = await makeFreelancerProfile();
    await assert.rejects(
      () => ratingService.addRating(profile.id, 0, undefined, undefined, undefined),
      (err: unknown) => err instanceof HttpError && err.statusCode === 422 && /integer between 1 and 5/.test(err.message)
    );
  });

  test("rejects a score above 5 with the real HttpError(422)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const profile = await makeFreelancerProfile();
    await assert.rejects(
      () => ratingService.addRating(profile.id, 6, undefined, undefined, undefined),
      (err: unknown) => err instanceof HttpError && err.statusCode === 422
    );
  });

  test("rejects a non-integer score with the real HttpError(422)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const profile = await makeFreelancerProfile();
    await assert.rejects(
      () => ratingService.addRating(profile.id, 3.5, undefined, undefined, undefined),
      (err: unknown) => err instanceof HttpError && err.statusCode === 422
    );
  });

  test("accepts a valid score of 1 and 5", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const profile = await makeFreelancerProfile();
    const r1 = await ratingService.addRating(profile.id, 1, undefined, undefined, undefined);
    createdRatingIds.push(r1.id);
    const r5 = await ratingService.addRating(profile.id, 5, undefined, undefined, undefined);
    createdRatingIds.push(r5.id);
    assert.equal(r1.score, 1);
    assert.equal(r5.score, 5);
  });
});

describe("ratingService.addRating -> updateFreelancerRatingAverage: the real chain (SEC-072 gap)", () => {
  test("creating ratings really recomputes the stored freelancer average, not just an in-memory formula", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const profile = await makeFreelancerProfile();

    const r1 = await ratingService.addRating(profile.id, 4, undefined, undefined, undefined);
    createdRatingIds.push(r1.id);
    const afterFirst = await prisma.freelancerProfile.findUniqueOrThrow({ where: { id: profile.id } });
    assert.equal(Number(afterFirst.rating), 4);
    assert.equal(afterFirst.reviewCount, 1);

    const r2 = await ratingService.addRating(profile.id, 2, undefined, undefined, undefined);
    createdRatingIds.push(r2.id);
    const afterSecond = await prisma.freelancerProfile.findUniqueOrThrow({ where: { id: profile.id } });
    assert.equal(Number(afterSecond.rating), 3, "(4 + 2) / 2 = 3, read back from the real row, not computed locally");
    assert.equal(afterSecond.reviewCount, 2);
  });
});

describe("ratingService.addRating: admin notification fan-out (SEC-072 gap)", () => {
  test("every rating enqueues a real GENERAL notification for each ADMIN", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const admin = await prisma.user.create({
      data: { email: `sec072-admin-${Date.now()}@test.local`, name: "SEC-072 Admin", passwordHash: "x", role: "ADMIN" },
    });
    createdUserIds.push(admin.id);
    const profile = await makeFreelancerProfile();

    const rating = await ratingService.addRating(profile.id, 4, "solid work", undefined, undefined);
    createdRatingIds.push(rating.id);

    const jobId = `notification|GENERAL|${rating.id}|${admin.id}`;
    let job = await communicationQueue.getJob(jobId);
    for (let i = 0; i < 20 && !job; i++) {
      await new Promise((r) => setTimeout(r, 25));
      job = await communicationQueue.getJob(jobId);
    }
    assert.ok(job, "addRating must enqueue a real notification job for this admin");
    assert.match(String(job!.data.message), /4\/5/);
    await job!.remove();
  });
});

describe("ratingService.addRating: low-rating n8n alert (SEC-072 gap)", () => {
  let server: http.Server;
  let received: { event: string; payload: Record<string, unknown> } | undefined;
  let originalBaseUrl: string | undefined;

  before(async () => {
    if (!dbAvailable) return;
    received = undefined;
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        received = JSON.parse(body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("{}");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    originalBaseUrl = env.N8N_WEBHOOK_BASE_URL;
    env.N8N_WEBHOOK_BASE_URL = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (!dbAvailable) return;
    env.N8N_WEBHOOK_BASE_URL = originalBaseUrl;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test("a score at the alert threshold (2) triggers a real notifyN8n call with the rating context", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const profile = await makeFreelancerProfile();

    const rating = await ratingService.addRating(profile.id, 2, "missed the deadline", undefined, undefined);
    createdRatingIds.push(rating.id);

    for (let i = 0; i < 40 && !received; i++) {
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.ok(received, "a score <= LOW_RATING_ALERT_THRESHOLD must trigger a real notifyN8n call");
    assert.equal(received!.event, "freelancer.rating_alert");
    assert.equal(received!.payload.freelancerId, profile.id);
    assert.equal(received!.payload.score, 2);
    assert.equal(received!.payload.comment, "missed the deadline");
  });

  test("a score above the alert threshold (3) does NOT trigger notifyN8n", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const profile = await makeFreelancerProfile();
    received = undefined;

    const rating = await ratingService.addRating(profile.id, 3, undefined, undefined, undefined);
    createdRatingIds.push(rating.id);

    await new Promise((r) => setTimeout(r, 300));
    assert.equal(received, undefined, "a score above the threshold must not trigger the n8n alert");
  });
});
