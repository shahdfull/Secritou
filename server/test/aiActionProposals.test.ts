// SEC-059 follow-up: write action proposals. Non-negotiable design rule under test — a propose*
// tool must NEVER perform a write. This test calls the real runAiActionTool against a real
// database (proposeCreateTask/proposeUpdateLeadStatus/proposeUpdateTaskStatus), asserting both
// that valid proposals reflect real scoped data and that no row is ever created/modified by the
// tool itself — only a real REST-equivalent call (not exercised here) would do that.
//
// Requires a real database (2 seeded Service rows); skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let runAiActionTool: typeof import("../src/services/aiActionProposals.js").runAiActionTool;
let isKnownAiActionTool: typeof import("../src/services/aiActionProposals.js").isKnownAiActionTool;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];
const createdLeadIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ runAiActionTool, isKnownAiActionTool } = await import("../src/services/aiActionProposals.js"));
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
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
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

describe("isKnownAiActionTool", () => {
  test("recognizes the 3 declared proposal tools and rejects an unknown/read tool name", () => {
    assert.equal(isKnownAiActionTool("proposeCreateTask"), true);
    assert.equal(isKnownAiActionTool("proposeUpdateLeadStatus"), true);
    assert.equal(isKnownAiActionTool("proposeUpdateTaskStatus"), true);
    assert.equal(isKnownAiActionTool("getTasks"), false, "a read tool must never be treated as an action tool");
    assert.equal(isKnownAiActionTool("deleteEverything"), false);
  });
});

describe("proposeCreateTask — validates without ever writing (follow-up)", () => {
  test("a valid proposal reflects the real project name, and creates no Task row", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProjectInService(serviceA, "ai-action-create-task");

    const proposal = await runAiActionTool("proposeCreateTask", { projectId: project.id, title: "Nouvelle tâche" }, {
      userRole: "ADMIN",
      userId: "admin-id",
    });

    assert.equal(proposal.type, "createTask");
    assert.equal(proposal.valid, true);
    if (proposal.type === "createTask" && proposal.valid) {
      assert.equal(proposal.projectId, project.id);
      assert.equal(proposal.projectName, project.name);
      assert.equal(proposal.title, "Nouvelle tâche");
    }
    const tasksOnProject = await prisma.task.findMany({ where: { projectId: project.id } });
    assert.equal(tasksOnProject.length, 0, "proposeCreateTask must never actually create a Task row");
  });

  test("a MANAGER proposing a task on another pole's project gets an invalid proposal, not a 403 thrown", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProjectInService(serviceB, "ai-action-create-task-other-pole");

    const proposal = await runAiActionTool("proposeCreateTask", { projectId: project.id, title: "Tâche hors pôle" }, {
      userRole: "MANAGER",
      userId: "manager-id",
      userServiceId: serviceA,
    });

    assert.equal(proposal.valid, false);
  });

  test("missing title or projectId yields an invalid proposal rather than throwing", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const proposal = await runAiActionTool("proposeCreateTask", { title: "Sans projet" }, { userRole: "ADMIN", userId: "admin-id" });
    assert.equal(proposal.valid, false);
  });
});

describe("proposeUpdateLeadStatus — validates the real transition table without ever writing (follow-up)", () => {
  test("a valid forward transition reflects the real lead name and current status, and updates no Lead row", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const uniq = Date.now();
    const lead = await prisma.lead.create({ data: { name: `ai-action-lead-${uniq}`, status: "NEW" } });
    createdLeadIds.push(lead.id);

    const proposal = await runAiActionTool("proposeUpdateLeadStatus", { leadId: lead.id, status: "QUALIFIED" }, {
      userRole: "ADMIN",
      userId: "admin-id",
    });

    assert.deepEqual(proposal, {
      type: "updateLeadStatus", valid: true, leadId: lead.id, leadName: lead.name, fromStatus: "NEW", toStatus: "QUALIFIED",
    });
    const unchanged = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    assert.equal(unchanged.status, "NEW", "proposeUpdateLeadStatus must never actually change the Lead row");
  });

  test("an illegal transition (WON is terminal) yields an invalid proposal", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const uniq = Date.now();
    const lead = await prisma.lead.create({ data: { name: `ai-action-lead-won-${uniq}`, status: "WON" } });
    createdLeadIds.push(lead.id);

    const proposal = await runAiActionTool("proposeUpdateLeadStatus", { leadId: lead.id, status: "CONTACTED" }, {
      userRole: "ADMIN",
      userId: "admin-id",
    });
    assert.equal(proposal.valid, false);
  });

  test("proposing the same status the lead already has yields an invalid proposal", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const uniq = Date.now();
    const lead = await prisma.lead.create({ data: { name: `ai-action-lead-same-${uniq}`, status: "QUALIFIED" } });
    createdLeadIds.push(lead.id);

    const proposal = await runAiActionTool("proposeUpdateLeadStatus", { leadId: lead.id, status: "QUALIFIED" }, {
      userRole: "ADMIN",
      userId: "admin-id",
    });
    assert.equal(proposal.valid, false);
  });

  test("a MANAGER proposing a status change on a lead from another pole (no assignedManagerId) gets an invalid proposal", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const uniq = Date.now();
    const lead = await prisma.lead.create({ data: { name: `ai-action-lead-scope-${uniq}`, status: "NEW", serviceId: serviceB } });
    createdLeadIds.push(lead.id);

    const proposal = await runAiActionTool("proposeUpdateLeadStatus", { leadId: lead.id, status: "CONTACTED" }, {
      userRole: "MANAGER",
      userId: "manager-id",
      userServiceId: serviceA,
    });
    assert.equal(proposal.valid, false);
  });
});

describe("proposeUpdateTaskStatus — validates the real transition table without ever writing (follow-up)", () => {
  test("a valid transition reflects the real task title and current status, and updates no Task row", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProjectInService(serviceA, "ai-action-task-status");
    const task = await prisma.task.create({ data: { title: "Tâche à démarrer", status: "TODO", projectId: project.id } });
    createdTaskIds.push(task.id);

    const proposal = await runAiActionTool("proposeUpdateTaskStatus", { taskId: task.id, status: "IN_PROGRESS" }, {
      userRole: "ADMIN",
      userId: "admin-id",
    });

    assert.deepEqual(proposal, {
      type: "updateTaskStatus", valid: true, taskId: task.id, taskTitle: task.title, fromStatus: "TODO", toStatus: "IN_PROGRESS",
    });
    const unchanged = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    assert.equal(unchanged.status, "TODO", "proposeUpdateTaskStatus must never actually change the Task row");
  });

  test("an illegal transition (TODO cannot jump directly to DONE) yields an invalid proposal", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProjectInService(serviceA, "ai-action-task-illegal");
    const task = await prisma.task.create({ data: { title: "Tâche bloquée", status: "TODO", projectId: project.id } });
    createdTaskIds.push(task.id);

    const proposal = await runAiActionTool("proposeUpdateTaskStatus", { taskId: task.id, status: "DONE" }, {
      userRole: "ADMIN",
      userId: "admin-id",
    });
    assert.equal(proposal.valid, false);
  });

  test("a MANAGER proposing a status change on a task from another pole's project gets an invalid proposal", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProjectInService(serviceB, "ai-action-task-other-pole");
    const task = await prisma.task.create({ data: { title: "Tâche hors pôle", status: "TODO", projectId: project.id } });
    createdTaskIds.push(task.id);

    const proposal = await runAiActionTool("proposeUpdateTaskStatus", { taskId: task.id, status: "IN_PROGRESS" }, {
      userRole: "MANAGER",
      userId: "manager-id",
      userServiceId: serviceA,
    });
    assert.equal(proposal.valid, false);
  });

  test("an out-of-enum status string yields an invalid proposal rather than crashing", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProjectInService(serviceA, "ai-action-task-badenum");
    const task = await prisma.task.create({ data: { title: "Tâche", status: "TODO", projectId: project.id } });
    createdTaskIds.push(task.id);

    const proposal = await runAiActionTool("proposeUpdateTaskStatus", { taskId: task.id, status: "NOT_A_REAL_STATUS" }, {
      userRole: "ADMIN",
      userId: "admin-id",
    });
    assert.equal(proposal.valid, false);
  });
});
