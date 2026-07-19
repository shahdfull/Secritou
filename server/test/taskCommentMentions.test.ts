// SEC-060 (mentions @ dans les commentaires, item 6 du constat P1 rapport Product Owner) : aucune
// logique de mention n'existait — confirmé par lecture directe de comment.service.ts (65 lignes)
// et TaskDetailDrawer.tsx, seules des notifications systématiques assignee+managers du pôle.
//
// Conception (décision du porteur, session 2026-07-19) : le flux standard notifie déjà tout le
// monde ayant accès à la tâche (assignee + staff du pôle), donc une mention ne peut jamais
// atteindre quelqu'un de nouveau — elle change seulement le libellé de LA notification que ce
// destinataire recevait déjà (pas de notification en double).
//
// This test imports and calls the real commentService.createComment against a real database,
// observing the real communicationQueue.addBulk calls via node:test's mock.method (not
// reimplementing enqueueNotifications) — proving:
// 1. Mentioning the task's assignee sends them a single notification with the more specific
//    "Vous avez été mentionné" wording instead of the generic "Nouveau commentaire" one.
// 2. The critical security property: mentioning an arbitrary user id with NO access to this task
//    (not the assignee, not staff of the task's pole) results in no notification for them at all
//    — this must never become a way to leak a task's existence to an arbitrary user by mentioning
//    their id in a comment.
// 3. A non-mentioned standard recipient still gets the generic wording, unaffected by someone
//    else's mention in the same comment.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";

process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

let prisma: typeof import("../src/config/prisma.js").prisma;
let commentService: typeof import("../src/services/comment.service.js").commentService;
let communicationQueue: typeof import("../src/jobs/queues.js").communicationQueue;
let dbAvailable = true;

let serviceA: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];
const createdCommentIds: string[] = [];
const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ commentService } = await import("../src/services/comment.service.js"));
    ({ communicationQueue } = await import("../src/jobs/queues.js"));
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
  await prisma.comment.deleteMany({ where: { id: { in: createdCommentIds } } });
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function makeTaskWithAssignee() {
  const client = await prisma.client.create({ data: { name: "mentions client", serviceId: serviceA } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: "mentions project", clientId: client.id, serviceId: serviceA } });
  createdProjectIds.push(project.id);
  const assignee = await prisma.user.create({
    data: { email: `mention-assignee-${Date.now()}-${Math.random()}@test.local`, name: "Assignee", passwordHash: "x", role: "FREELANCER" },
  });
  createdUserIds.push(assignee.id);
  const task = await prisma.task.create({ data: { title: "mentions task", projectId: project.id, assigneeId: assignee.id } });
  createdTaskIds.push(task.id);
  return { task, assignee };
}

async function makeOutsider() {
  const user = await prisma.user.create({
    data: { email: `mention-outsider-${Date.now()}-${Math.random()}@test.local`, name: "Outsider", passwordHash: "x", role: "FREELANCER" },
  });
  createdUserIds.push(user.id);
  return user;
}

async function makeAuthor(suffix: string) {
  const author = await prisma.user.create({
    data: { email: `mention-author-${suffix}-${Date.now()}-${Math.random()}@test.local`, name: `Author-${suffix}`, passwordHash: "x", role: "ADMIN" },
  });
  createdUserIds.push(author.id);
  return author;
}

describe("commentService.createComment mentions — SEC-060", () => {
  test("mentioning the task's assignee sends them a single notification with the mention wording", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const { task, assignee } = await makeTaskWithAssignee();
    const author = await makeAuthor("1");

    const addBulkMock = mock.method(communicationQueue, "addBulk", async () => []);
    t.after(() => addBulkMock.mock.restore());

    const comment = await commentService.createComment({
      content: `Regarde ça @[Assignee](${assignee.id})`,
      taskId: task.id,
      authorId: author.id,
    });
    createdCommentIds.push(comment.id);

    await new Promise((resolve) => setImmediate(resolve));

    const allJobs = addBulkMock.mock.calls.flatMap((call) => call.arguments[0] as { data: { userId: string; title: string } }[]);
    const assigneeJobs = allJobs.filter((job) => job.data.userId === assignee.id);
    assert.equal(assigneeJobs.length, 1, "the mentioned assignee must get exactly one notification, not a duplicate");
    assert.equal(assigneeJobs[0]?.data.title, "Vous avez été mentionné");
  });

  test("mentioning a user with no access to the task results in no notification for them (security)", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const { task } = await makeTaskWithAssignee();
    const outsider = await makeOutsider();
    const author = await makeAuthor("2");

    const addBulkMock = mock.method(communicationQueue, "addBulk", async () => []);
    t.after(() => addBulkMock.mock.restore());

    const comment = await commentService.createComment({
      content: `Hors sujet @[Outsider](${outsider.id})`,
      taskId: task.id,
      authorId: author.id,
    });
    createdCommentIds.push(comment.id);

    await new Promise((resolve) => setImmediate(resolve));

    const allJobs = addBulkMock.mock.calls.flatMap((call) => call.arguments[0] as { data: { userId: string } }[]);
    assert.ok(
      !allJobs.some((job) => job.data.userId === outsider.id),
      "an outsider mentioned in a comment must never be notified"
    );
  });

  test("a non-mentioned standard recipient still gets the generic wording", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const { task, assignee } = await makeTaskWithAssignee();
    const author = await makeAuthor("3");

    const addBulkMock = mock.method(communicationQueue, "addBulk", async () => []);
    t.after(() => addBulkMock.mock.restore());

    const comment = await commentService.createComment({
      content: "Un commentaire tout à fait normal, sans mention.",
      taskId: task.id,
      authorId: author.id,
    });
    createdCommentIds.push(comment.id);

    await new Promise((resolve) => setImmediate(resolve));

    const allJobs = addBulkMock.mock.calls.flatMap((call) => call.arguments[0] as { data: { userId: string; title: string } }[]);
    const assigneeJob = allJobs.find((job) => job.data.userId === assignee.id);
    assert.equal(assigneeJob?.data.title, "Nouveau commentaire");
  });
});
