// SEC-059: the AI assistant's tool-calling dispatcher (aiTools.ts) must scope MANAGER callers to
// their own pole exactly like the equivalent REST endpoints — it reuses projectService/
// taskService, but a wiring mistake (wrong scope object, wrong argument order) would silently
// leak cross-pole data into the model's context. This test imports and calls the real
// runAiTool/isKnownAiTool against a real database, not a reimplementation of the scoping rule.
//
// Requires a real database (2 seeded Service rows); skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let runAiTool: typeof import("../src/services/aiTools.js").runAiTool;
let isKnownAiTool: typeof import("../src/services/aiTools.js").isKnownAiTool;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];
const createdUserIds: string[] = [];
const createdFreelancerProfileIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ runAiTool, isKnownAiTool } = await import("../src/services/aiTools.js"));
    await prisma.$queryRaw`SELECT 1`;
    const services = await prisma.service.findMany({ take: 2 });
    if (services.length < 2) throw new Error("need at least 2 seeded Service rows");
    serviceA = services[0]!.id;
    serviceB = services[1]!.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.freelancerProfile.deleteMany({ where: { id: { in: createdFreelancerProfileIds } } });
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

// freelancerRepository.findAll scopes MANAGER via user.tasks.some.project.serviceId — a freelancer
// is only "in" a pole through a task assigned to a project of that pole, never a direct serviceId
// field on the freelancer itself.
async function makeFreelancerInService(serviceId: string, namePrefix: string) {
  const uniq = Date.now() + Math.random();
  const user = await prisma.user.create({
    data: {
      name: `${namePrefix} freelancer`,
      email: `${namePrefix}-${uniq}@example.com`,
      passwordHash: "x",
      role: "FREELANCER",
    },
  });
  createdUserIds.push(user.id);
  const profile = await prisma.freelancerProfile.create({ data: { userId: user.id } });
  createdFreelancerProfileIds.push(profile.id);
  const project = await makeProjectInService(serviceId, `${namePrefix}-project`);
  const task = await prisma.task.create({
    data: { title: `${namePrefix} task`, projectId: project.id, assigneeId: user.id },
  });
  createdTaskIds.push(task.id);
  return { user, profile };
}

describe("isKnownAiTool", () => {
  test("recognizes the 5 declared read tools and rejects an unknown name", () => {
    assert.equal(isKnownAiTool("getLeads"), true);
    assert.equal(isKnownAiTool("getClients"), true);
    assert.equal(isKnownAiTool("getProjects"), true);
    assert.equal(isKnownAiTool("getTasks"), true);
    assert.equal(isKnownAiTool("getFreelancers"), true);
    assert.equal(isKnownAiTool("deleteEverything"), false);
    assert.equal(isKnownAiTool("execCommand"), false);
  });
});

describe("aiTools getProjects — scoped by role (SEC-059, real code, not a reimplementation)", () => {
  test("ADMIN sees projects across every pole", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const projectA = await makeProjectInService(serviceA, "ai-tool-admin-a");
    const projectB = await makeProjectInService(serviceB, "ai-tool-admin-b");

    const result = (await runAiTool("getProjects", {}, { userRole: "ADMIN", userId: "admin-id" })) as {
      projects: { id: string }[];
    };
    const names = result.projects.map((p) => p.id);
    assert.ok(names.includes(projectA.id));
    assert.ok(names.includes(projectB.id));
  });

  test("MANAGER only sees projects in their own pole", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const projectA = await makeProjectInService(serviceA, "ai-tool-mgr-a");
    const projectB = await makeProjectInService(serviceB, "ai-tool-mgr-b");

    const result = (await runAiTool("getProjects", {}, {
      userRole: "MANAGER",
      userId: "manager-id",
      userServiceId: serviceA,
    })) as { projects: { id: string }[] };
    const ids = result.projects.map((p) => p.id);
    assert.ok(ids.includes(projectA.id), "manager must see a project in their own pole");
    assert.ok(!ids.includes(projectB.id), "manager must not see a project from another pole");
  });

  test("a search argument is forwarded to the real text-search filter", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const uniq = Date.now();
    const project = await makeProjectInService(serviceA, `ai-tool-search-${uniq}`);

    const result = (await runAiTool("getProjects", { search: `ai-tool-search-${uniq}` }, {
      userRole: "ADMIN",
      userId: "admin-id",
    })) as { projects: { id: string }[] };
    assert.deepEqual(result.projects.map((p) => p.id), [project.id]);
  });
});

describe("aiTools getFreelancers — scoped by role, delegated to freelancerService (SEC-059/follow-up)", () => {
  test("ADMIN sees freelancers across every pole", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const { user: userA } = await makeFreelancerInService(serviceA, "ai-tool-freelancer-admin-a");
    const { user: userB } = await makeFreelancerInService(serviceB, "ai-tool-freelancer-admin-b");

    const result = (await runAiTool("getFreelancers", {}, { userRole: "ADMIN", userId: "admin-id" })) as {
      freelancers: { id: string; name: string }[];
    };
    const names = result.freelancers.map((f) => f.name);
    assert.ok(names.includes(userA.name));
    assert.ok(names.includes(userB.name));
  });

  test("MANAGER only sees freelancers with a task in their own pole", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const { user: userA } = await makeFreelancerInService(serviceA, "ai-tool-freelancer-mgr-a");
    const { user: userB } = await makeFreelancerInService(serviceB, "ai-tool-freelancer-mgr-b");

    const result = (await runAiTool("getFreelancers", {}, {
      userRole: "MANAGER",
      userId: "manager-id",
      userServiceId: serviceA,
    })) as { freelancers: { name: string }[] };
    const names = result.freelancers.map((f) => f.name);
    assert.ok(names.includes(userA.name), "manager must see a freelancer with a task in their own pole");
    assert.ok(!names.includes(userB.name), "manager must not see a freelancer scoped to another pole");
  });

  test("a MANAGER with userServiceId undefined (key omitted) sees every freelancer, mirroring freelancer.controller.ts#getFreelancers exactly (not a stricter reimplementation)", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const { user: userA } = await makeFreelancerInService(serviceA, "ai-tool-freelancer-noscope-a");

    // userServiceId deliberately omitted (undefined), not passed as null — freelancerRepository
    // treats options.serviceId === undefined as "no filter" (options.serviceId !== undefined check)
    // but a literal null still builds a real WHERE serviceId = NULL filter, which is a different,
    // narrower case this test is not exercising.
    const result = (await runAiTool("getFreelancers", {}, {
      userRole: "MANAGER",
      userId: "manager-id",
    })) as { freelancers: { name: string }[] };
    const names = result.freelancers.map((f) => f.name);
    assert.ok(names.includes(userA.name), "a MANAGER with userServiceId undefined gets no filter, same as the REST endpoint — not '__none__'");
  });
});

describe("aiTools runAiTool — malformed arguments degrade to no filter (SEC-059)", () => {
  test("a non-string search argument is ignored rather than thrown", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    // A hallucinated tool_calls.arguments shape (e.g. {search: 42}) must not crash the request —
    // parseArgs silently drops it, same as no filter being provided at all.
    const result = (await runAiTool("getProjects", { search: 42 }, { userRole: "ADMIN", userId: "admin-id" })) as {
      total: number;
    };
    assert.equal(typeof result.total, "number");
  });

  test("an out-of-enum status string is ignored rather than crashing the underlying Prisma query", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const result = (await runAiTool("getTasks", { status: "NOT_A_REAL_STATUS" }, {
      userRole: "ADMIN",
      userId: "admin-id",
    })) as { total: number };
    assert.equal(typeof result.total, "number");
  });
});

describe("aiTools structured filters — status/priority/overdue on getTasks (follow-up)", () => {
  test("status filter forwards to the real exact-match filter, not a text search", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProjectInService(serviceA, "ai-tool-task-status");
    const todoTask = await prisma.task.create({ data: { title: "todo task", status: "TODO", projectId: project.id } });
    const doneTask = await prisma.task.create({ data: { title: "done task", status: "DONE", projectId: project.id } });
    createdTaskIds.push(todoTask.id, doneTask.id);

    const result = (await runAiTool("getTasks", { status: "DONE" }, { userRole: "ADMIN", userId: "admin-id" })) as {
      tasks: { id: string }[];
    };
    const ids = result.tasks.map((t) => t.id);
    assert.ok(ids.includes(doneTask.id));
    assert.ok(!ids.includes(todoTask.id));
  });

  test("overdue filter forwards to taskRepository's real overdue logic (dueDate in the past, not DONE)", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProjectInService(serviceA, "ai-tool-task-overdue");
    const overdueTask = await prisma.task.create({
      data: { title: "overdue task", status: "TODO", dueDate: new Date(Date.now() - 86_400_000), projectId: project.id },
    });
    const futureTask = await prisma.task.create({
      data: { title: "future task", status: "TODO", dueDate: new Date(Date.now() + 86_400_000), projectId: project.id },
    });
    createdTaskIds.push(overdueTask.id, futureTask.id);

    const result = (await runAiTool("getTasks", { overdue: true }, { userRole: "ADMIN", userId: "admin-id" })) as {
      tasks: { id: string }[];
    };
    const ids = result.tasks.map((t) => t.id);
    assert.ok(ids.includes(overdueTask.id));
    assert.ok(!ids.includes(futureTask.id));
  });
});

describe("aiTools truncated field — signals an incomplete list rather than presenting it as exhaustive (follow-up)", () => {
  test("truncated is false when total fits within the page size", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    // Scoped by a search term unique to this test, not by pole alone — other tests in this file
    // (and this describe block runs against a shared DB, not a fresh one per test) also create
    // projects on serviceA, so asserting on serviceA's raw total would be polluted by them.
    const uniq = Date.now();
    await makeProjectInService(serviceA, `ai-tool-truncation-small-${uniq}`);

    const result = (await runAiTool("getProjects", { search: `ai-tool-truncation-small-${uniq}` }, {
      userRole: "MANAGER",
      userId: "manager-id",
      userServiceId: serviceA,
    })) as { total: number; truncated: boolean };
    assert.equal(result.total, 1);
    assert.equal(result.truncated, false);
  });

  test("truncated is true when total exceeds the tool's page size", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const uniq = Date.now();
    for (let i = 0; i < 21; i++) {
      await makeProjectInService(serviceB, `ai-tool-truncation-big-${uniq}-${i}`);
    }

    const result = (await runAiTool("getProjects", {}, { userRole: "MANAGER", userId: "manager-id", userServiceId: serviceB })) as {
      total: number;
      truncated: boolean;
    };
    assert.ok(result.total > 20);
    assert.equal(result.truncated, true);
  });
});
