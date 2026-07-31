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
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeProjectInService(serviceId: string, namePrefix: string) {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client`, serviceId } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: `${namePrefix} project`, clientId: client.id, serviceId } });
  createdProjectIds.push(project.id);
  return project;
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
});
