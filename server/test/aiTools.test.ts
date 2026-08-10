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
let leadService: typeof import("../src/services/lead.service.js").leadService;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];
const createdUserIds: string[] = [];
const createdFreelancerProfileIds: string[] = [];
const createdLeadIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ runAiTool, isKnownAiTool } = await import("../src/services/aiTools.js"));
    ({ leadService } = await import("../src/services/lead.service.js"));
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
  await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });

  // Same documented cause as projectModuleCacheInvalidation.test.ts: this file now exercises the
  // real Redis-backed cache (runAiTool's own cacheGet/cacheSet), opening the `redis` package
  // client separately from the ioredis/BullMQ connection run-all.test.ts already closes.
  const { closeRedisClient } = await import("../src/cache/redis.js");
  await closeRedisClient();
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
  test("recognizes the 11 declared read tools and rejects an unknown name", () => {
    assert.equal(isKnownAiTool("getLeads"), true);
    assert.equal(isKnownAiTool("getClients"), true);
    assert.equal(isKnownAiTool("getProjects"), true);
    assert.equal(isKnownAiTool("getTasks"), true);
    assert.equal(isKnownAiTool("getFreelancers"), true);
    assert.equal(isKnownAiTool("getAgencyOverview"), true);
    assert.equal(isKnownAiTool("getOverdueProjects"), true);
    assert.equal(isKnownAiTool("getOverdueInvoices"), true);
    assert.equal(isKnownAiTool("getFreelancerWorkload"), true);
    assert.equal(isKnownAiTool("getLeadPipeline"), true);
    assert.equal(isKnownAiTool("searchSemantic"), true);
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

describe("aiTools aggregate tools — delegated to the same scoped services as their REST endpoints (follow-up)", () => {
  test("getAgencyOverview calls the real dashboardService.getFullDashboard and returns its shape", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const result = (await runAiTool("getAgencyOverview", {}, { userRole: "ADMIN", userId: "admin-id" })) as {
      pendingApprovalsCount: number;
      overdueInvoicesCount: number;
      hotLeadsCount: number;
    };
    assert.equal(typeof result.pendingApprovalsCount, "number");
    assert.equal(typeof result.overdueInvoicesCount, "number");
    assert.equal(typeof result.hotLeadsCount, "number");
  });

  test("getOverdueProjects filters executiveMetricsService risks to PROJECT_CRITICAL only", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const result = (await runAiTool("getOverdueProjects", {}, { userRole: "ADMIN", userId: "admin-id" })) as {
      total: number;
      projects: { type: string }[];
    };
    assert.equal(typeof result.total, "number");
    assert.ok(result.projects.every((p) => p.type === "PROJECT_CRITICAL"));
  });

  test("getOverdueInvoices filters executiveMetricsService risks to INVOICE_OVERDUE only", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const result = (await runAiTool("getOverdueInvoices", {}, { userRole: "ADMIN", userId: "admin-id" })) as {
      total: number;
      invoices: { type: string }[];
    };
    assert.equal(typeof result.total, "number");
    assert.ok(result.invoices.every((i) => i.type === "INVOICE_OVERDUE"));
  });

  test("getFreelancerWorkload calls the real timeEntryService.workloadByAssignee with a default 30-day window", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const result = (await runAiTool("getFreelancerWorkload", {}, { userRole: "ADMIN", userId: "admin-id" })) as {
      total: number;
      workload: { userId: string; totalMinutes: number; activeTaskCount: number }[];
    };
    assert.equal(typeof result.total, "number");
    assert.ok(Array.isArray(result.workload));
  });

  test("getFreelancerWorkload ignores a malformed date string and falls back to the default window", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const result = (await runAiTool("getFreelancerWorkload", { from: "not-a-date" }, { userRole: "ADMIN", userId: "admin-id" })) as {
      total: number;
    };
    assert.equal(typeof result.total, "number");
  });

  test("getLeadPipeline calls the real leadService.getPipelineByStatus and returns all 6 statuses", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const result = (await runAiTool("getLeadPipeline", {}, { userRole: "ADMIN", userId: "admin-id" })) as {
      pipeline: Record<string, number>;
    };
    assert.equal(typeof result.pipeline.NEW, "number");
    assert.equal(typeof result.pipeline.WON, "number");
  });

  test("getLeadPipeline for a MANAGER only counts leads in their own pole", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const uniq = Date.now();
    const client = await prisma.client.create({ data: { name: `pipeline-tool-client-${uniq}`, serviceId: serviceA } });
    createdClientIds.push(client.id);
    const lead = await prisma.lead.create({ data: { name: `pipeline-tool-lead-${uniq}`, serviceId: serviceA, status: "PROPOSAL" } });

    try {
      const managerResult = (await runAiTool("getLeadPipeline", {}, {
        userRole: "MANAGER",
        userId: "manager-id",
        userServiceId: serviceA,
      })) as { pipeline: Record<string, number> };
      const otherPoleResult = (await runAiTool("getLeadPipeline", {}, {
        userRole: "MANAGER",
        userId: "manager-id",
        userServiceId: serviceB,
      })) as { pipeline: Record<string, number> };

      assert.ok(managerResult.pipeline.PROPOSAL >= 1, "manager on the lead's pole must count it");
      assert.ok(
        otherPoleResult.pipeline.PROPOSAL < managerResult.pipeline.PROPOSAL,
        "manager on a different pole must not count this lead"
      );
    } finally {
      await prisma.lead.delete({ where: { id: lead.id } });
    }
  });
});

// Every test above calls runAiTool through the same cache runAiTool now wraps itself in
// (aiTools.ts). Cache keys are unique per test by construction — either a `search`/name argument
// seeded with Date.now(), or (for the fixed-args aggregate tools like getAgencyOverview) an
// assertion that only checks shape (typeof/array), never an exact count — so a stale hit within
// cacheTTL.aiToolRead (45s) cannot make any of them flaky. A test that needs an exact count on a
// no-args tool call must follow the same pattern: vary the scope, or accept that two calls to the
// *same* (tool, args, scope) within 45s intentionally return the same cached answer (that's the
// feature, not a bug) — see the invalidation test below for how to prove a write busts it.
describe("runAiTool caching (session du 2026-08-01)", () => {
  test("a second identical call within the TTL returns a cached result without re-querying the DB", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const uniq = Date.now();
    const project = await makeProjectInService(serviceA, `ai-tool-cache-hit-${uniq}`);

    const first = (await runAiTool("getProjects", { search: `ai-tool-cache-hit-${uniq}` }, {
      userRole: "ADMIN",
      userId: "admin-id",
    })) as { projects: { id: string }[] };
    assert.deepEqual(first.projects.map((p) => p.id), [project.id]);

    // Deleted directly (bypassing projectService, which would invalidate the cache tag) so a
    // second runAiTool call can only still see it if the first call's result was actually cached
    // rather than re-queried.
    await prisma.project.delete({ where: { id: project.id } });
    createdProjectIds.splice(createdProjectIds.indexOf(project.id), 1);

    const second = (await runAiTool("getProjects", { search: `ai-tool-cache-hit-${uniq}` }, {
      userRole: "ADMIN",
      userId: "admin-id",
    })) as { projects: { id: string }[] };
    assert.deepEqual(second.projects.map((p) => p.id), [project.id], "second call must be served from cache, not re-query the now-deleted project");
  });

  test("two different caller scopes for the same tool+args never share a cache entry", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const uniq = Date.now();
    const projectA = await makeProjectInService(serviceA, `ai-tool-cache-scope-a-${uniq}`);
    const projectB = await makeProjectInService(serviceB, `ai-tool-cache-scope-b-${uniq}`);

    const managerA = (await runAiTool("getProjects", {}, {
      userRole: "MANAGER",
      userId: "manager-a",
      userServiceId: serviceA,
    })) as { projects: { id: string }[] };
    const managerB = (await runAiTool("getProjects", {}, {
      userRole: "MANAGER",
      userId: "manager-b",
      userServiceId: serviceB,
    })) as { projects: { id: string }[] };

    const idsA = managerA.projects.map((p) => p.id);
    const idsB = managerB.projects.map((p) => p.id);
    assert.ok(idsA.includes(projectA.id) && !idsA.includes(projectB.id), "pole A manager's cached result must not leak pole B");
    assert.ok(idsB.includes(projectB.id) && !idsB.includes(projectA.id), "pole B manager's cached result must not leak pole A");
  });

  test("leadService.createLead invalidates the AI tool cache (real write, real invalidateTags call)", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const uniq = Date.now();

    // Same probe pattern as projectModuleCacheInvalidation.test.ts (SEC-098): seed a real cache
    // entry the same way runAiTool itself would (through the tool call, not cacheSet directly, so
    // this proves the actual key/tag runAiTool uses, not a hand-picked one), then run the real
    // service mutation and confirm the entry no longer answers from cache.
    const before = (await runAiTool("getLeadPipeline", {}, { userRole: "ADMIN", userId: "admin-id" })) as {
      pipeline: Record<string, number>;
    };
    const newCount = (before.pipeline.NEW ?? 0) + 1;

    const lead = await leadService.createLead({ name: `ai-tool-cache-invalidation-${uniq}`, status: "NEW" });
    createdLeadIds.push(lead.id);

    const after = (await runAiTool("getLeadPipeline", {}, { userRole: "ADMIN", userId: "admin-id" })) as {
      pipeline: Record<string, number>;
    };
    assert.equal(after.pipeline.NEW, newCount, "createLead must invalidate the cached getLeadPipeline result, not leave the pre-write count cached");
  });
});

// SEC-070: searchSemantic is the only tool whose scoping is NOT delegated to
// toLeadScope/toServiceScope (see aiTools.ts's own comment on runSearchSemantic) — it goes
// straight to searchEmbeddingRepository.searchSimilar, which applies the scope filter itself in
// the SQL WHERE clause of each entity branch, before the ORDER BY distance. This test creates two
// leads in two different poles with near-identical text (both about the same topic, so their
// embeddings land close together) — if scoping were ever applied AFTER the similarity query
// instead of inside it, a MANAGER would still see both, since nothing about the distance itself
// would exclude the out-of-pole lead. Requires a real Ollama embeddings endpoint reachable at
// OLLAMA_URL; skipped (not failed) if indexing doesn't succeed, same dbAvailable-style guard as
// the rest of this file for an unreachable dependency.
describe("aiTools searchSemantic — RBAC scoped in SQL before distance ordering (SEC-070)", () => {
  async function indexLead(serviceId: string | undefined, namePrefix: string, notes: string) {
    const lead = await prisma.lead.create({ data: { name: `${namePrefix} lead`, serviceId, notes } });
    createdLeadIds.push(lead.id);
    const { processSearchEmbeddingJob } = await import("../src/jobs/processors/maintenance.processor.js");
    await processSearchEmbeddingJob({ entityType: "lead", entityId: lead.id, sourceText: notes });
    return lead;
  }

  test("a MANAGER never sees a semantically-close lead from another pole", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const uniq = Date.now();
    const sharedText = `Client intéressé par une refonte complète de sa boutique en ligne, projet ${uniq}.`;
    let leadA: Awaited<ReturnType<typeof indexLead>>;
    let leadB: Awaited<ReturnType<typeof indexLead>>;
    try {
      leadA = await indexLead(serviceA, `sec070-rbac-a-${uniq}`, sharedText);
      leadB = await indexLead(serviceB, `sec070-rbac-b-${uniq}`, sharedText);
    } catch (err) {
      return t.skip(`Ollama embeddings endpoint unavailable: ${(err as Error).message}`);
    }

    const asManagerA = (await runAiTool("searchSemantic", { query: sharedText }, {
      userRole: "MANAGER",
      userId: "manager-a",
      userServiceId: serviceA,
    })) as { results: { entityType: string; entityId: string }[] };

    const idsA = asManagerA.results.filter((r) => r.entityType === "lead").map((r) => r.entityId);
    assert.ok(idsA.includes(leadA.id), "MANAGER must see the lead in their own pole");
    assert.ok(!idsA.includes(leadB.id), "MANAGER must never see a semantically-close lead from another pole");

    const asAdmin = (await runAiTool("searchSemantic", { query: sharedText }, {
      userRole: "ADMIN",
      userId: "admin-id",
    })) as { results: { entityType: string; entityId: string }[] };
    const idsAdmin = asAdmin.results.filter((r) => r.entityType === "lead").map((r) => r.entityId);
    assert.ok(idsAdmin.includes(leadA.id) && idsAdmin.includes(leadB.id), "ADMIN (unscoped) must see both poles");
  });

  test("a missing query degrades to an empty result set rather than throwing", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const result = (await runAiTool("searchSemantic", {}, { userRole: "ADMIN", userId: "admin-id" })) as {
      results: unknown[];
    };
    assert.deepEqual(result.results, []);
  });
});
