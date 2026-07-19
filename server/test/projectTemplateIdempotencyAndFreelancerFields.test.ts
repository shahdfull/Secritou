// Rapport backend/sécurité (B1 + B5), session 2026-07-19. Deux constats confirmés par lecture
// directe, tous deux prouvés ici par des appels réels aux services contre une base migrée — pas
// de réimplémentation.
//
// B1 (SEC-043) — projectTemplateService.applyToProject n'avait aucun garde-fou serveur contre
//   une double application : seule l'UI masque le bouton une fois le projet doté de tâches.
//   Un double-clic / rejeu réseau / appel API direct dupliquait tout le lot de tâches du
//   template. Un garde d'idempotence (409 TEMPLATE_ALREADY_APPLIED si le projet a déjà des
//   tâches) a été ajouté.
//
// B5 (SEC-045) — PUT /tasks/:id autorise FREELANCER au niveau routeur ; la vraie restriction
//   (« un FREELANCER ne peut modifier QUE le statut de SES propres tâches ») vit uniquement dans
//   task.service.ts#updateTask. C'est une règle d'exclusivité/négative — CLAUDE.md exige un test
//   qui appelle le code réel, pas un grep. Aucun test ne l'assérait jusqu'ici.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let taskService: typeof import("../src/services/task.service.js").taskService;
let projectTemplateService: typeof import("../src/services/projectTemplate.service.js").projectTemplateService;
let createTaskSchema: typeof import("../src/validators/task.validator.js").createTaskSchema;
let HttpError: typeof import("../src/utils/httpError.js").HttpError;
let dbAvailable = true;
// createTaskSchema imports @prisma/client enums; it loads regardless of DB reachability, so its
// validation tests run even when the DB is down (they never touch prisma). Loaded in before().
let schemaLoaded = true;

let serviceA: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTemplateIds: string[] = [];
const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ taskService } = await import("../src/services/task.service.js"));
    ({ projectTemplateService } = await import("../src/services/projectTemplate.service.js"));
    ({ HttpError } = await import("../src/utils/httpError.js"));
    await prisma.$queryRaw`SELECT 1`;
    const services = await prisma.service.findMany({ take: 1 });
    if (services.length < 1) throw new Error("need at least 1 seeded Service row");
    serviceA = services[0]!.id;
  } catch {
    dbAvailable = false;
  }
  try {
    ({ createTaskSchema } = await import("../src/validators/task.validator.js"));
  } catch {
    schemaLoaded = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.task.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.projectTemplate.deleteMany({ where: { id: { in: createdTemplateIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function makeProject() {
  const client = await prisma.client.create({ data: { name: "tmpl-idem client", serviceId: serviceA } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: "tmpl-idem project", clientId: client.id, serviceId: serviceA } });
  createdProjectIds.push(project.id);
  return project;
}

async function ensureTemplateForServiceA() {
  // One ProjectTemplate per service (serviceId is @unique). Reuse if a prior test/seed created it.
  const existing = await prisma.projectTemplate.findUnique({ where: { serviceId: serviceA } });
  if (existing) return existing;
  const template = await prisma.projectTemplate.create({
    data: {
      serviceId: serviceA,
      name: "idem template",
      tasks: { create: [{ title: "T1", orderIndex: 0 }, { title: "T2", orderIndex: 1 }] },
    },
  });
  createdTemplateIds.push(template.id);
  return template;
}

describe("projectTemplateService.applyToProject idempotence — SEC-043 (B1)", () => {
  test("applies the template to an empty project", { skip: !dbAvailable }, async () => {
    await ensureTemplateForServiceA();
    const project = await makeProject();
    const tasks = await projectTemplateService.applyToProject(project.id, { userRole: "ADMIN" });
    assert.ok(tasks.length >= 2);
    const count = await prisma.task.count({ where: { projectId: project.id } });
    assert.ok(count >= 2);
  });

  test("a second apply on a project that already has tasks is rejected 409 TEMPLATE_ALREADY_APPLIED", { skip: !dbAvailable }, async () => {
    await ensureTemplateForServiceA();
    const project = await makeProject();
    await projectTemplateService.applyToProject(project.id, { userRole: "ADMIN" });
    const countAfterFirst = await prisma.task.count({ where: { projectId: project.id } });

    await assert.rejects(
      () => projectTemplateService.applyToProject(project.id, { userRole: "ADMIN" }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 409 && err.code === "TEMPLATE_ALREADY_APPLIED"
    );

    // The guard must not have half-applied: task count is unchanged after the rejected second call.
    const countAfterSecond = await prisma.task.count({ where: { projectId: project.id } });
    assert.equal(countAfterSecond, countAfterFirst);
  });

  test("a project with any pre-existing task (not from a template) is also refused", { skip: !dbAvailable }, async () => {
    await ensureTemplateForServiceA();
    const project = await makeProject();
    await prisma.task.create({ data: { title: "manual task", projectId: project.id } });

    await assert.rejects(
      () => projectTemplateService.applyToProject(project.id, { userRole: "ADMIN" }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 409 && err.code === "TEMPLATE_ALREADY_APPLIED"
    );
  });

  test("SEC-073: two strictly concurrent applies on the same empty project never both succeed", { skip: !dbAvailable }, async () => {
    const template = await ensureTemplateForServiceA();
    const project = await makeProject();
    const templateTaskCount = await prisma.taskTemplate.count({ where: { templateId: template.id } });

    const results = await Promise.allSettled([
      projectTemplateService.applyToProject(project.id, { userRole: "ADMIN" }),
      projectTemplateService.applyToProject(project.id, { userRole: "ADMIN" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1, "exactly one of the two concurrent applies must succeed");
    assert.equal(rejected.length, 1, "the other concurrent apply must be rejected, never silently no-op");
    assert.ok(
      rejected[0]!.status === "rejected" &&
        rejected[0].reason instanceof HttpError &&
        rejected[0].reason.statusCode === 409,
      "the losing call must surface as 409, not an unrelated error"
    );

    // The critical property this test exists for: the template batch was never inserted twice.
    const finalCount = await prisma.task.count({ where: { projectId: project.id } });
    assert.equal(finalCount, templateTaskCount, "concurrent applies must never duplicate the template's task batch");
  });
});

describe("task.service.updateTask FREELANCER field restriction — SEC-045 (B5)", () => {
  async function makeFreelancerAndTask() {
    const project = await makeProject();
    const freelancer = await prisma.user.create({
      data: { email: `flancer-${project.id}@test.local`, name: "F", passwordHash: "x", role: "FREELANCER" },
    });
    createdUserIds.push(freelancer.id);
    const task = await prisma.task.create({ data: { title: "freelancer task", projectId: project.id, assigneeId: freelancer.id, status: "TODO" } });
    return { project, freelancer, task };
  }

  test("a FREELANCER may update the status of their own task", { skip: !dbAvailable }, async () => {
    const { freelancer, task } = await makeFreelancerAndTask();
    const updated = await taskService.updateTask(task.id, { status: "IN_PROGRESS" }, { userRole: "FREELANCER", userId: freelancer.id });
    assert.equal(updated.status, "IN_PROGRESS");
  });

  test("a FREELANCER updating any field other than status is rejected 403 DISALLOWED_FIELD_UPDATE", { skip: !dbAvailable }, async () => {
    const { freelancer, task } = await makeFreelancerAndTask();
    await assert.rejects(
      () => taskService.updateTask(task.id, { title: "hijacked title" }, { userRole: "FREELANCER", userId: freelancer.id }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 403 && err.code === "DISALLOWED_FIELD_UPDATE"
    );
  });

  test("a FREELANCER updating status AND another field in the same call is still rejected", { skip: !dbAvailable }, async () => {
    const { freelancer, task } = await makeFreelancerAndTask();
    await assert.rejects(
      () => taskService.updateTask(task.id, { status: "IN_PROGRESS", description: "sneaky" }, { userRole: "FREELANCER", userId: freelancer.id }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 403 && err.code === "DISALLOWED_FIELD_UPDATE"
    );
  });

  test("a FREELANCER cannot touch a task assigned to someone else (403 TASK_NOT_ASSIGNED_TO_YOU)", { skip: !dbAvailable }, async () => {
    const { task } = await makeFreelancerAndTask();
    const other = await prisma.user.create({
      data: { email: `other-${task.id}@test.local`, name: "O", passwordHash: "x", role: "FREELANCER" },
    });
    createdUserIds.push(other.id);
    await assert.rejects(
      () => taskService.updateTask(task.id, { status: "IN_PROGRESS" }, { userRole: "FREELANCER", userId: other.id }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 403 && err.code === "TASK_NOT_ASSIGNED_TO_YOU"
    );
  });
});

describe("createTaskSchema date validation — SEC-044 (B4)", () => {
  const base = { title: "t", projectId: "p1" };

  test("accepts a YYYY-MM-DD calendar date (what <input type=date> sends)", { skip: !schemaLoaded }, () => {
    const r = createTaskSchema.safeParse({ body: { ...base, startDate: "2024-03-15", dueDate: "2024-03-20" } });
    assert.equal(r.success, true);
  });

  test("accepts a full ISO 8601 datetime (what the meeting client sends)", { skip: !schemaLoaded }, () => {
    const r = createTaskSchema.safeParse({ body: { ...base, dueDate: "2024-03-20T09:30:00.000Z" } });
    assert.equal(r.success, true);
  });

  test("rejects a free-text date that Date.parse would have accepted before", { skip: !schemaLoaded }, () => {
    for (const bad of ["March 3", "2024/1/1", "Sat Jan 01 2024", "demain"]) {
      const r = createTaskSchema.safeParse({ body: { ...base, dueDate: bad } });
      assert.equal(r.success, false, `expected "${bad}" to be rejected`);
    }
  });

  test("still allows omitting the dates entirely", { skip: !schemaLoaded }, () => {
    const r = createTaskSchema.safeParse({ body: base });
    assert.equal(r.success, true);
  });
});
