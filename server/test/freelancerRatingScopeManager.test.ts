// SEC-026/SEC-027: freelancerService.getById and ratingService.addRating/
// getRatingsByFreelancerId never scoped a MANAGER by pole — unlike
// freelancerRepository.findAll, which already filters via
// user.tasks.some.project.serviceId. A MANAGER could read any freelancer's full profile
// (hourlyRate included) via a direct id, or read/create ratings for a freelancer with no task
// in their own pole.
//
// This test imports and calls the real freelancerService/ratingService against a real database
// — not a reimplementation — confirming a pole-A Manager is refused a pole-B freelancer's profile
// and ratings, while a same-pole Manager and an ADMIN (unscoped) still succeed.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

let prisma: typeof import("../src/config/prisma.js").prisma;
let freelancerService: typeof import("../src/services/freelancer.service.js").freelancerService;
let ratingService: typeof import("../src/services/rating.service.js").ratingService;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
let raterUser: { id: string };
const createdUserIds: string[] = [];
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];
const createdFreelancerProfileIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ freelancerService } = await import("../src/services/freelancer.service.js"));
    ({ ratingService } = await import("../src/services/rating.service.js"));
    await prisma.$queryRaw`SELECT 1`;
    const services = await prisma.service.findMany({ take: 2 });
    if (services.length < 2) throw new Error("need at least 2 seeded Service rows");
    serviceA = services[0]!.id;
    serviceB = services[1]!.id;
    raterUser = await prisma.user.create({ data: { email: `sec027-rater-${Date.now()}@test.local`, name: "Rater", passwordHash: "x", role: "MANAGER", serviceId: serviceA } });
    createdUserIds.push(raterUser.id);
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.rating.deleteMany({ where: { freelancerId: { in: createdFreelancerProfileIds } } });
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.freelancerProfile.deleteMany({ where: { id: { in: createdFreelancerProfileIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function makeFreelancerWithTaskInPole(serviceId: string, namePrefix: string) {
  const suffix = Date.now() + Math.random();
  const freelancerUser = await prisma.user.create({
    data: { email: `${namePrefix}-${suffix}@test.local`, name: `${namePrefix} freelancer`, passwordHash: "x", role: "FREELANCER" },
  });
  createdUserIds.push(freelancerUser.id);
  const profile = await prisma.freelancerProfile.create({ data: { userId: freelancerUser.id, hourlyRate: "50" } });
  createdFreelancerProfileIds.push(profile.id);

  const client = await prisma.client.create({ data: { name: `${namePrefix} client`, serviceId } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: `${namePrefix} project`, clientId: client.id, serviceId } });
  createdProjectIds.push(project.id);
  const task = await prisma.task.create({ data: { title: `${namePrefix} task`, projectId: project.id, assigneeId: freelancerUser.id } });
  createdTaskIds.push(task.id);

  return profile;
}

describe("SEC-026: freelancerService.getById enforces Manager pole scope", () => {
  test("a pole-A Manager cannot read a pole-B freelancer's profile by direct id", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const profile = await makeFreelancerWithTaskInPole(serviceB, "sec026-b");

    await assert.rejects(
      () => freelancerService.getById(profile.id, serviceA),
      (err: unknown) => err instanceof HttpError && err.statusCode === 404
    );
  });

  test("a same-pole Manager can read the freelancer's profile", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const profile = await makeFreelancerWithTaskInPole(serviceA, "sec026-a");

    const found = await freelancerService.getById(profile.id, serviceA);
    assert.equal(found.id, profile.id);
  });

  test("an ADMIN (unscoped) can read a freelancer's profile from any pole", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const profile = await makeFreelancerWithTaskInPole(serviceB, "sec026-admin-b");

    const found = await freelancerService.getById(profile.id, undefined);
    assert.equal(found.id, profile.id);
  });
});

describe("SEC-027: ratingService enforces Manager pole scope", () => {
  test("a pole-A Manager cannot create a rating for a pole-B freelancer", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const profile = await makeFreelancerWithTaskInPole(serviceB, "sec027-create-b");

    await assert.rejects(
      () => ratingService.addRating(profile.id, 4, undefined, raterUser.id, serviceA),
      (err: unknown) => err instanceof HttpError && err.statusCode === 404
    );
  });

  test("a same-pole Manager can create a rating", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const profile = await makeFreelancerWithTaskInPole(serviceA, "sec027-create-a");

    const rating = await ratingService.addRating(profile.id, 4, undefined, raterUser.id, serviceA);
    assert.equal(rating.freelancerId, profile.id);
  });

  test("a pole-A Manager cannot read ratings for a pole-B freelancer", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const profile = await makeFreelancerWithTaskInPole(serviceB, "sec027-read-b");

    await assert.rejects(
      () => ratingService.getRatingsByFreelancerId(profile.id, serviceA),
      (err: unknown) => err instanceof HttpError && err.statusCode === 404
    );
  });
});
