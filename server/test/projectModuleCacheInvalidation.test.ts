// SEC-098: comment/checklist/meeting mutations never invalidated the project/client cache tags
// that summary.service.ts writes under (cacheTags.project/cacheTags.client) — inconsistent with
// task.service.ts/project.service.ts, which invalidate on every write. Confirmed before fixing
// that no current consumer re-reads those specific cache keys (summary.service.ts writes via
// cacheSet but never reads back via cacheGet for project/client summaries — only the dashboard
// summary does a real read-then-write cycle), so this was a consistency fix, not a fix for an
// observed stale value.
//
// This test writes a real tagged cache entry via cacheSet (the same primitive
// summary.service.ts uses), calls the real commentService/taskChecklistService/
// projectMeetingService mutations against a migrated database, and confirms the tagged entry is
// gone afterwards — proving invalidateTags is actually reached, not just imported.
//
// Requires a real database and Redis; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let commentService: typeof import("../src/services/comment.service.js").commentService;
let taskChecklistService: typeof import("../src/services/taskChecklist.service.js").taskChecklistService;
let projectMeetingService: typeof import("../src/services/projectMeeting.service.js").projectMeetingService;
let cacheGet: typeof import("../src/cache/cacheService.js").cacheGet;
let cacheSet: typeof import("../src/cache/cacheService.js").cacheSet;
let cacheKeys: typeof import("../src/cache/cacheKeys.js").cacheKeys;
let cacheTags: typeof import("../src/cache/cacheKeys.js").cacheTags;
let dbAvailable = true;

let serviceA: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];
const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ commentService } = await import("../src/services/comment.service.js"));
    ({ taskChecklistService } = await import("../src/services/taskChecklist.service.js"));
    ({ projectMeetingService } = await import("../src/services/projectMeeting.service.js"));
    ({ cacheGet, cacheSet } = await import("../src/cache/cacheService.js"));
    ({ cacheKeys, cacheTags } = await import("../src/cache/cacheKeys.js"));
    await prisma.$queryRaw`SELECT 1`;
    const services = await prisma.service.findMany({ take: 1 });
    if (services.length < 1) throw new Error("need at least 1 seeded Service row");
    serviceA = services[0]!.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.comment.deleteMany({ where: { taskId: { in: createdTaskIds } } });
  await prisma.taskChecklistItem.deleteMany({ where: { taskId: { in: createdTaskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });

  // This file is (one of the few) that exercises cacheSet/invalidateTags for real, opening the
  // `redis` package client separate from the ioredis/BullMQ connection run-all.test.ts already
  // closes (see portalActivationOnPayment.test.ts for the same documented cause).
  const { closeRedisClient } = await import("../src/cache/redis.js");
  await closeRedisClient();
});

async function makeProjectAndTask(namePrefix: string) {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client`, serviceId: serviceA } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: `${namePrefix} project`, clientId: client.id, serviceId: serviceA } });
  createdProjectIds.push(project.id);
  const task = await prisma.task.create({ data: { title: `${namePrefix} task`, projectId: project.id } });
  createdTaskIds.push(task.id);
  return { client, project, task };
}

async function makeAuthor(suffix: string) {
  const user = await prisma.user.create({
    data: { email: `cache-invalidation-${suffix}-${Date.now()}@test.local`, name: `U-${suffix}`, passwordHash: "x", role: "MANAGER", serviceId: serviceA },
  });
  createdUserIds.push(user.id);
  return user;
}

async function seedTaggedProjectCacheEntry(projectId: string) {
  const key = cacheKeys.projectSummary(projectId);
  await cacheSet(key, { probe: true }, 120, [cacheTags.project(projectId)]);
  return key;
}

describe("Project/client cache invalidation on comment/checklist/meeting mutations — SEC-098", () => {
  test("createComment invalidates the project's tagged cache entries", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const { project, task } = await makeProjectAndTask("cache-comment-create");
    const author = await makeAuthor("comment");
    const key = await seedTaggedProjectCacheEntry(project.id);
    assert.ok(await cacheGet(key), "the probe cache entry must exist before the mutation");

    await commentService.createComment({ content: "hello", taskId: task.id, authorId: author.id });

    assert.equal(await cacheGet(key), null, "createComment must invalidate the project's cache tag");
  });

  test("createItem (checklist) invalidates the project's tagged cache entries", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const { project, task } = await makeProjectAndTask("cache-checklist-create");
    const key = await seedTaggedProjectCacheEntry(project.id);
    assert.ok(await cacheGet(key), "the probe cache entry must exist before the mutation");

    await taskChecklistService.createItem(task.id, "item");

    assert.equal(await cacheGet(key), null, "createItem must invalidate the project's cache tag");
  });

  test("projectMeetingService.create invalidates the project's tagged cache entries", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const { project } = await makeProjectAndTask("cache-meeting-create");
    const key = await seedTaggedProjectCacheEntry(project.id);
    assert.ok(await cacheGet(key), "the probe cache entry must exist before the mutation");

    await projectMeetingService.create(project.id, { meetingDate: new Date() });

    assert.equal(await cacheGet(key), null, "projectMeetingService.create must invalidate the project's cache tag");
  });
});
