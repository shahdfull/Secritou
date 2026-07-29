// SEC-020/SEC-021: timeEntryService.create/list/mySummary never called assertProjectInScope —
// a MANAGER could log/list/read time entries on a project outside their own pôle, and a
// FREELANCER staffed on a project (≥1 assigned task there) could log time against a colleague's
// taskId on the same project. Imports and calls the real timeEntryService against a real
// database, not a reimplementation.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

let prisma: typeof import("../src/config/prisma.js").prisma;
let timeEntryService: typeof import("../src/services/timeEntry.service.js").timeEntryService;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
let adminUser: { id: string };
let managerUser: { id: string };
let freelancerA: { id: string };
let freelancerB: { id: string };
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];
const createdTimeEntryIds: string[] = [];
const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ timeEntryService } = await import("../src/services/timeEntry.service.js"));
    await prisma.$queryRaw`SELECT 1`;
    const services = await prisma.service.findMany({ take: 2 });
    if (services.length < 2) throw new Error("need at least 2 seeded Service rows");
    serviceA = services[0]!.id;
    serviceB = services[1]!.id;

    const suffix = Date.now();
    adminUser = await prisma.user.create({ data: { email: `sec020-admin-${suffix}@test.local`, name: "Admin", passwordHash: "x", role: "ADMIN" } });
    managerUser = await prisma.user.create({ data: { email: `sec020-manager-${suffix}@test.local`, name: "Manager", passwordHash: "x", role: "MANAGER", serviceId: serviceA } });
    freelancerA = await prisma.user.create({ data: { email: `sec021-freelancer-a-${suffix}@test.local`, name: "Freelancer A", passwordHash: "x", role: "FREELANCER" } });
    freelancerB = await prisma.user.create({ data: { email: `sec021-freelancer-b-${suffix}@test.local`, name: "Freelancer B", passwordHash: "x", role: "FREELANCER" } });
    createdUserIds.push(adminUser.id, managerUser.id, freelancerA.id, freelancerB.id);
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.timeEntry.deleteMany({ where: { id: { in: createdTimeEntryIds } } });
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function makeProjectInService(serviceId: string, namePrefix: string) {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client`, serviceId } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: `${namePrefix} project`, clientId: client.id, serviceId } });
  createdProjectIds.push(project.id);
  return project;
}

describe("timeEntryService MANAGER project scope (SEC-020, real code, not a reimplementation)", () => {
  test("MANAGER of another pole cannot create a time entry on a foreign project", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const projectB = await makeProjectInService(serviceB, "sec020-create-b");

    await assert.rejects(
      () =>
        timeEntryService.create(
          projectB.id,
          managerUser.id,
          "MANAGER",
          { minutes: 30, date: new Date() },
          { userRole: "MANAGER", userServiceId: serviceA }
        ),
      (err: unknown) => err instanceof HttpError && (err.statusCode === 403 || err.statusCode === 404)
    );
  });

  test("MANAGER of the same pole can create a time entry", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const projectA = await makeProjectInService(serviceA, "sec020-create-a");

    const entry = await timeEntryService.create(
      projectA.id,
      managerUser.id,
      "MANAGER",
      { minutes: 30, date: new Date() },
      { userRole: "MANAGER", userServiceId: serviceA }
    );
    createdTimeEntryIds.push(entry.id);
    assert.equal(entry.projectId, projectA.id);
  });

  test("MANAGER of another pole cannot list time entries on a foreign project", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const projectB = await makeProjectInService(serviceB, "sec020-list-b");

    await assert.rejects(
      () => timeEntryService.list(projectB.id, 1, 20, managerUser.id, "MANAGER", { userRole: "MANAGER", userServiceId: serviceA }),
      (err: unknown) => err instanceof HttpError && (err.statusCode === 403 || err.statusCode === 404)
    );
  });

  test("MANAGER of another pole cannot read their own time summary on a foreign project", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const projectB = await makeProjectInService(serviceB, "sec020-mysummary-b");

    await assert.rejects(
      () => timeEntryService.mySummary(projectB.id, managerUser.id, { userRole: "MANAGER", userServiceId: serviceA }),
      (err: unknown) => err instanceof HttpError && (err.statusCode === 403 || err.statusCode === 404)
    );
  });

  test("ADMIN is never scoped by pole", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const projectB = await makeProjectInService(serviceB, "sec020-admin-b");

    const entry = await timeEntryService.create(projectB.id, adminUser.id, "ADMIN", { minutes: 10, date: new Date() }, { userRole: "ADMIN" });
    createdTimeEntryIds.push(entry.id);
    assert.equal(entry.projectId, projectB.id);
  });
});

describe("timeEntryService FREELANCER task ownership (SEC-021, real code, not a reimplementation)", () => {
  test("a FREELANCER staffed on a project cannot log time on a colleague's task", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProjectInService(serviceA, "sec021-project");
    const ownTask = await prisma.task.create({ data: { title: "own task", projectId: project.id, assigneeId: freelancerA.id } });
    createdTaskIds.push(ownTask.id);
    const colleagueTask = await prisma.task.create({ data: { title: "colleague task", projectId: project.id, assigneeId: freelancerB.id } });
    createdTaskIds.push(colleagueTask.id);

    await assert.rejects(
      () =>
        timeEntryService.create(project.id, freelancerA.id, "FREELANCER", {
          taskId: colleagueTask.id,
          minutes: 30,
          date: new Date(),
        }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 404
    );
  });

  test("a FREELANCER can log time on their own task", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProjectInService(serviceA, "sec021-own-project");
    const ownTask = await prisma.task.create({ data: { title: "own task", projectId: project.id, assigneeId: freelancerA.id } });
    createdTaskIds.push(ownTask.id);

    const entry = await timeEntryService.create(project.id, freelancerA.id, "FREELANCER", {
      taskId: ownTask.id,
      minutes: 45,
      date: new Date(),
    });
    createdTimeEntryIds.push(entry.id);
    assert.equal(entry.taskId, ownTask.id);
  });
});
