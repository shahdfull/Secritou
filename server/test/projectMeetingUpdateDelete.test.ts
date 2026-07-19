// SEC-055 (F6, rapport développeur full-stack, session 2026-07-19) : ProjectMeetingsTab.tsx had no
// edit/delete for a logged meeting, and server/src/routes/project.routes.ts only declared
// GET/POST on /:id/meetings — confirmed by grep, zero PUT/DELETE existed even server-side. On a
// multi-year project with weekly cadence, an entry once logged could never be corrected or
// removed, and the (unpaginated) list could grow to hundreds of rows.
//
// This test imports and calls the real projectMeetingService.update/delete against a real
// database — not a reimplementation — proving:
// 1. The meeting's own author can edit/delete it.
// 2. A different MANAGER (not the author, not ADMIN) is refused with 403 MEETING_NOT_YOURS — the
//    critical authorization property this correctif introduces, since requirePermission("projects",
//    "update") alone would let any MANAGER of the project's pole touch a colleague's note.
// 3. ADMIN can edit/delete any meeting regardless of authorship.
// 4. listByProject paginates correctly when page/pageSize are supplied.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

let prisma: typeof import("../src/config/prisma.js").prisma;
let projectMeetingService: typeof import("../src/services/projectMeeting.service.js").projectMeetingService;
let dbAvailable = true;

let serviceA: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdMeetingIds: string[] = [];
const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ projectMeetingService } = await import("../src/services/projectMeeting.service.js"));
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
  await prisma.projectMeeting.deleteMany({ where: { id: { in: createdMeetingIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function makeProject() {
  const client = await prisma.client.create({ data: { name: "meeting-crud client", serviceId: serviceA } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: "meeting-crud project", clientId: client.id, serviceId: serviceA } });
  createdProjectIds.push(project.id);
  return project;
}

async function makeManager(suffix: string) {
  const user = await prisma.user.create({
    data: { email: `mgr-${suffix}@test.local`, name: `M-${suffix}`, passwordHash: "x", role: "MANAGER", serviceId: serviceA },
  });
  createdUserIds.push(user.id);
  return user;
}

async function makeMeeting(projectId: string, createdById: string) {
  const meeting = await prisma.projectMeeting.create({
    data: { projectId, meetingDate: new Date(), notes: "note initiale", createdById },
  });
  createdMeetingIds.push(meeting.id);
  return meeting;
}

describe("projectMeetingService.update/delete authorization — SEC-055 (F6)", () => {
  test("the meeting's own author can edit it", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProject();
    const author = await makeManager("author1");
    const meeting = await makeMeeting(project.id, author.id);

    const updated = await projectMeetingService.update(
      project.id,
      meeting.id,
      { notes: "note corrigée" },
      author.id,
      "MANAGER"
    );

    assert.equal(updated.notes, "note corrigée");
  });

  test("the meeting's own author can delete it", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProject();
    const author = await makeManager("author2");
    const meeting = await makeMeeting(project.id, author.id);

    await projectMeetingService.delete(project.id, meeting.id, author.id, "MANAGER");

    const stillThere = await prisma.projectMeeting.findUnique({ where: { id: meeting.id } });
    assert.equal(stillThere, null);
  });

  test("a different MANAGER (not the author) is refused with 403 MEETING_NOT_YOURS", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProject();
    const author = await makeManager("author3");
    const otherManager = await makeManager("other3");
    const meeting = await makeMeeting(project.id, author.id);

    await assert.rejects(
      () => projectMeetingService.update(project.id, meeting.id, { notes: "tentative" }, otherManager.id, "MANAGER"),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "MEETING_NOT_YOURS");
        return true;
      }
    );

    await assert.rejects(
      () => projectMeetingService.delete(project.id, meeting.id, otherManager.id, "MANAGER"),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "MEETING_NOT_YOURS");
        return true;
      }
    );

    // Confirm the meeting really wasn't touched by the rejected calls.
    const stillThere = await prisma.projectMeeting.findUnique({ where: { id: meeting.id } });
    assert.equal(stillThere?.notes, "note initiale");
  });

  test("ADMIN can edit/delete any meeting regardless of authorship", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProject();
    const author = await makeManager("author4");
    const meeting = await makeMeeting(project.id, author.id);

    const updated = await projectMeetingService.update(
      project.id,
      meeting.id,
      { notes: "corrigé par un admin" },
      "admin-id",
      "ADMIN"
    );
    assert.equal(updated.notes, "corrigé par un admin");

    await projectMeetingService.delete(project.id, meeting.id, "admin-id", "ADMIN");
    const stillThere = await prisma.projectMeeting.findUnique({ where: { id: meeting.id } });
    assert.equal(stillThere, null);
  });

  test("updating/deleting a meeting that doesn't belong to the given project 404s", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProject();
    const otherProject = await makeProject();
    const author = await makeManager("author5");
    const meeting = await makeMeeting(project.id, author.id);

    await assert.rejects(
      () => projectMeetingService.update(otherProject.id, meeting.id, { notes: "x" }, author.id, "MANAGER"),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });
});

describe("projectMeetingService.listByProject pagination — SEC-055 (F6)", () => {
  test("paginates when page/pageSize are supplied", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProject();
    const author = await makeManager("pager1");
    for (let i = 0; i < 5; i++) {
      const meeting = await prisma.projectMeeting.create({
        data: { projectId: project.id, meetingDate: new Date(Date.now() - i * 86_400_000), createdById: author.id },
      });
      createdMeetingIds.push(meeting.id);
    }

    const page1 = await projectMeetingService.listByProject(project.id, undefined, 1, 2);
    assert.equal(page1.total, 5);
    assert.equal(page1.data.length, 2);

    const page3 = await projectMeetingService.listByProject(project.id, undefined, 3, 2);
    assert.equal(page3.data.length, 1);
  });

  test("omitting page/pageSize returns the full unpaginated list (existing callers unaffected)", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProject();
    const author = await makeManager("pager2");
    for (let i = 0; i < 3; i++) {
      const meeting = await prisma.projectMeeting.create({
        data: { projectId: project.id, meetingDate: new Date(), createdById: author.id },
      });
      createdMeetingIds.push(meeting.id);
    }

    const result = await projectMeetingService.listByProject(project.id);
    assert.equal(result.total, 3);
    assert.equal(result.data.length, 3);
  });
});
