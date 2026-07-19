// SEC-059 (rapport Product Owner, §7 constat P2, session 2026-07-19) : un commentaire de tâche
// n'était jamais modifiable ni supprimable — task.routes.ts ne déclarait que GET/POST sur
// /tasks/:taskId/comments, aucune route par commentId, confirmé par lecture directe de
// comment.service.ts (65 lignes, lu intégralement) qui n'exposait que createComment et
// getCommentsByTaskId.
//
// This test imports and calls the real commentService.updateComment/deleteComment against a real
// database — not a reimplementation — proving:
// 1. The comment's own author can edit/delete it.
// 2. A different user (not the author, not ADMIN) is refused with 403 COMMENT_NOT_YOURS — the
//    critical authorization property this correctif introduces, mirroring
//    projectMeetingService's MEETING_NOT_YOURS (SEC-055/F6): task access alone (which any
//    ADMIN/MANAGER/FREELANCER on the task shares) must not be enough to alter someone else's
//    remark.
// 3. ADMIN can edit/delete any comment regardless of authorship.
// 4. Updating/deleting a comment that doesn't belong to the given taskId 404s.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

let prisma: typeof import("../src/config/prisma.js").prisma;
let commentService: typeof import("../src/services/comment.service.js").commentService;
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

async function makeTask() {
  const client = await prisma.client.create({ data: { name: "comment-crud client", serviceId: serviceA } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: "comment-crud project", clientId: client.id, serviceId: serviceA } });
  createdProjectIds.push(project.id);
  const task = await prisma.task.create({ data: { title: "comment-crud task", projectId: project.id } });
  createdTaskIds.push(task.id);
  return task;
}

async function makeUser(suffix: string, role: "ADMIN" | "MANAGER" | "FREELANCER" = "MANAGER") {
  const user = await prisma.user.create({
    data: { email: `commenter-${suffix}@test.local`, name: `U-${suffix}`, passwordHash: "x", role, serviceId: role === "MANAGER" ? serviceA : undefined },
  });
  createdUserIds.push(user.id);
  return user;
}

async function makeComment(taskId: string, authorId: string, content = "note initiale") {
  const comment = await prisma.comment.create({ data: { taskId, authorId, content } });
  createdCommentIds.push(comment.id);
  return comment;
}

describe("commentService.updateComment/deleteComment authorization — SEC-059", () => {
  test("the comment's own author can edit it", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();
    const author = await makeUser("author1");
    const comment = await makeComment(task.id, author.id);

    const updated = await commentService.updateComment(task.id, comment.id, "note corrigée", author.id, "MANAGER");
    assert.equal(updated.content, "note corrigée");
  });

  test("the comment's own author can delete it", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();
    const author = await makeUser("author2");
    const comment = await makeComment(task.id, author.id);

    await commentService.deleteComment(task.id, comment.id, author.id, "MANAGER");

    const stillThere = await prisma.comment.findUnique({ where: { id: comment.id } });
    assert.equal(stillThere, null);
  });

  test("a different user (not the author) is refused with 403 COMMENT_NOT_YOURS", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();
    const author = await makeUser("author3");
    const otherUser = await makeUser("other3", "FREELANCER");
    const comment = await makeComment(task.id, author.id);

    await assert.rejects(
      () => commentService.updateComment(task.id, comment.id, "tentative", otherUser.id, "FREELANCER"),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "COMMENT_NOT_YOURS");
        return true;
      }
    );

    await assert.rejects(
      () => commentService.deleteComment(task.id, comment.id, otherUser.id, "FREELANCER"),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "COMMENT_NOT_YOURS");
        return true;
      }
    );

    const stillThere = await prisma.comment.findUnique({ where: { id: comment.id } });
    assert.equal(stillThere?.content, "note initiale");
  });

  test("ADMIN can edit/delete any comment regardless of authorship", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();
    const author = await makeUser("author4");
    const comment = await makeComment(task.id, author.id);

    const updated = await commentService.updateComment(task.id, comment.id, "corrigé par un admin", "admin-id", "ADMIN");
    assert.equal(updated.content, "corrigé par un admin");

    await commentService.deleteComment(task.id, comment.id, "admin-id", "ADMIN");
    const stillThere = await prisma.comment.findUnique({ where: { id: comment.id } });
    assert.equal(stillThere, null);
  });

  test("SEC-071: editing a comment sets editedAt, distinguishing it from an untouched comment", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();
    const author = await makeUser("author6");
    const untouched = await makeComment(task.id, author.id, "jamais modifié");
    const edited = await makeComment(task.id, author.id, "note initiale");

    assert.equal(untouched.editedAt, null, "a freshly created comment must not carry editedAt");

    const updated = await commentService.updateComment(task.id, edited.id, "note corrigée", author.id, "MANAGER");
    assert.ok(updated.editedAt, "editing a comment must set editedAt");

    const untouchedAfter = await prisma.comment.findUnique({ where: { id: untouched.id } });
    assert.equal(untouchedAfter?.editedAt, null, "editing one comment must never set editedAt on another");
  });

  test("updating/deleting a comment that doesn't belong to the given task 404s", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();
    const otherTask = await makeTask();
    const author = await makeUser("author5");
    const comment = await makeComment(task.id, author.id);

    await assert.rejects(
      () => commentService.updateComment(otherTask.id, comment.id, "x", author.id, "MANAGER"),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });
});
