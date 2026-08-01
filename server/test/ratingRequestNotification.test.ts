// SEC-072: this file used to reimplement the freelancer-selection and notify-once logic of
// project.service.ts#clientApprove locally ("mirrors the Prisma query", "mirrors clientApprove's
// already-completed guard") instead of importing the real service — it would have stayed green
// even if the real code diverged. Rewritten to import and call the real projectService.clientApprove
// against a real database, following the same real-code fixture pattern already used by
// clientApproveEmailPortalUrl.test.ts (SEC-168) for the same function.
//
// Also fills the coverage gap this comparison surfaced: the real notification fan-out is
// `managers.flatMap(m => freelancers.map(f => ...))` (one RATING_REQUESTED notification per
// admin x freelancer pair, entityId = freelancerProfile.id) — never previously observed against
// a real BullMQ queue.
//
// Requires a real, migrated database and reachable Redis; skipped otherwise.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let projectService: typeof import("../src/services/project.service.js").projectService;
let communicationQueue: typeof import("../src/jobs/queues.js").communicationQueue;
let dbAvailable = true;

let serviceId: string;
const createdClientIds: string[] = [];
const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
const createdFreelancerProfileIds: string[] = [];
const createdTaskIds: string[] = [];
const createdJobIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ projectService } = await import("../src/services/project.service.js"));
    ({ communicationQueue } = await import("../src/jobs/queues.js"));
    await prisma.$queryRaw`SELECT 1`;
    await communicationQueue.waitUntilReady();
    const service = await prisma.service.findFirst();
    if (!service) throw new Error("no Service seeded");
    serviceId = service.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  for (const jobId of createdJobIds) {
    const job = await communicationQueue.getJob(jobId);
    // Best-effort: a real worker (env.JOBS_ENABLED) may already have this job locked.
    await job?.remove().catch(() => {});
  }
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.freelancerProfile.deleteMany({ where: { id: { in: createdFreelancerProfileIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeReviewProject(uniq: string) {
  const client = await prisma.client.create({ data: { name: `sec072-rrn-client-${uniq}`, serviceId } });
  createdClientIds.push(client.id);
  const clientUser = await prisma.user.create({
    data: { email: `sec072-rrn-clientuser-${uniq}@test.local`, name: "SEC-072 client user", passwordHash: "x", role: "CLIENT", clientId: client.id },
  });
  createdUserIds.push(clientUser.id);
  const project = await prisma.project.create({
    data: { name: `SEC-072 rrn project ${uniq}`, clientId: client.id, serviceId, status: "REVIEW" },
  });
  createdProjectIds.push(project.id);
  return { client, clientUser, project };
}

async function makeFreelancerAssignee(projectId: string, uniq: string) {
  const freelancerUser = await prisma.user.create({
    data: { email: `sec072-rrn-freelancer-${uniq}@test.local`, name: "SEC-072 Freelancer", passwordHash: "x", role: "FREELANCER" },
  });
  createdUserIds.push(freelancerUser.id);
  const profile = await prisma.freelancerProfile.create({ data: { userId: freelancerUser.id, hourlyRate: "50" } });
  createdFreelancerProfileIds.push(profile.id);
  const task = await prisma.task.create({
    data: { title: `SEC-072 rrn task ${uniq}`, projectId, status: "DONE", assigneeId: freelancerUser.id },
  });
  createdTaskIds.push(task.id);
  return { freelancerUser, profile };
}

async function pollForJob(jobId: string, attempts = 60, delayMs = 25) {
  let job = await communicationQueue.getJob(jobId);
  for (let i = 0; i < attempts && !job; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    job = await communicationQueue.getJob(jobId);
  }
  return job;
}

describe("projectService.clientApprove: rating-request notification (real code, SEC-072)", () => {
  test("completing a project with one freelancer assignee enqueues one real RATING_REQUESTED notification per admin", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const admin = await prisma.user.create({
      data: { email: `sec072-rrn-admin-${uniq}@test.local`, name: "SEC-072 Admin", passwordHash: "x", role: "ADMIN" },
    });
    createdUserIds.push(admin.id);
    const { client, clientUser, project } = await makeReviewProject(uniq);
    const { profile } = await makeFreelancerAssignee(project.id, uniq);

    const approved = await projectService.clientApprove(project.id, client.id, clientUser.id);
    assert.ok(approved, "clientApprove must resolve successfully");

    const jobId = `notification|RATING_REQUESTED|${profile.id}|${admin.id}`;
    createdJobIds.push(jobId);
    const job = await pollForJob(jobId);
    assert.ok(job, "clientApprove must enqueue a real RATING_REQUESTED notification for this admin/freelancer pair");
    assert.match(String(job!.data.link), new RegExp(`/app/freelancers/${profile.id}$`));
  });

  test("a project with no freelancer assignees enqueues no RATING_REQUESTED notification", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const admin = await prisma.user.create({
      data: { email: `sec072-rrn-noassignee-admin-${uniq}@test.local`, name: "SEC-072 Admin", passwordHash: "x", role: "ADMIN" },
    });
    createdUserIds.push(admin.id);
    const { client, clientUser, project } = await makeReviewProject(uniq);
    // No task, no assignee at all.

    await projectService.clientApprove(project.id, client.id, clientUser.id);

    // Give the fire-and-forget block a bounded window to have enqueued anything it would.
    await new Promise((r) => setTimeout(r, 300));
    const anyJob = await communicationQueue.getJob(`notification|RATING_REQUESTED|none|${admin.id}`);
    assert.equal(anyJob, undefined, "no freelancer assignee means no rating-request notification should exist");
  });

  test("completing a project a second time does not enqueue a duplicate notification (already-completed guard)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const admin = await prisma.user.create({
      data: { email: `sec072-rrn-twice-admin-${uniq}@test.local`, name: "SEC-072 Admin", passwordHash: "x", role: "ADMIN" },
    });
    createdUserIds.push(admin.id);
    const { client, clientUser, project } = await makeReviewProject(uniq);
    const { profile } = await makeFreelancerAssignee(project.id, uniq);

    await projectService.clientApprove(project.id, client.id, clientUser.id);
    const jobId = `notification|RATING_REQUESTED|${profile.id}|${admin.id}`;
    createdJobIds.push(jobId);
    const firstJob = await pollForJob(jobId);
    assert.ok(firstJob, "first approval must enqueue the notification");

    await assert.rejects(
      () => projectService.clientApprove(project.id, client.id, clientUser.id),
      (err: unknown) => (err as { code?: string })?.code === "PROJECT_ALREADY_APPROVED" || (err as { code?: string })?.code === "PROJECT_ALREADY_COMPLETED"
    );
  });
});
