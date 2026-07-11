// Tests for the rating-request notification triggered from project.service.clientApprove :
// no DB, no real imports. Pattern (matches project.clientApprove.test.ts): mirror the relevant
// logic against in-memory fakes.
// Source: src/services/project.service.ts (clientApprove, "Prompt ADMIN/MANAGER ... to rate"
// block) and project.clientApprove.test.ts (PROJECT_ALREADY_COMPLETED guard it relies on).

import test, { describe } from "node:test";
import assert from "node:assert/strict";

type TaskAssignee = {
  id: string;
  role: "ADMIN" | "MANAGER" | "CLIENT" | "FREELANCER";
  freelancerProfileId: string | null;
};

type Task = { id: string; projectId: string; assignee: TaskAssignee | null };

// Mirrors the Prisma query in clientApprove: tasks on the project whose assignee is a
// FREELANCER with a profile, deduplicated by assignee.
function selectFreelancersToNotify(tasks: Task[], projectId: string) {
  const seen = new Set<string>();
  const result: { id: string; freelancerProfileId: string }[] = [];
  for (const t of tasks) {
    if (t.projectId !== projectId) continue;
    const a = t.assignee;
    if (!a || a.role !== "FREELANCER" || !a.freelancerProfileId) continue;
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    result.push({ id: a.id, freelancerProfileId: a.freelancerProfileId });
  }
  return result;
}

// Mirrors clientApprove's already-completed guard : this is what prevents the rating-request
// notification block from ever running twice for the same project.
function runClientApprove(state: { status: string; clientApprovedAt: Date | null }, notify: () => void) {
  if (state.clientApprovedAt) throw Object.assign(new Error("PROJECT_ALREADY_APPROVED"), { code: "PROJECT_ALREADY_APPROVED" });
  if (state.status === "COMPLETED") throw Object.assign(new Error("PROJECT_ALREADY_COMPLETED"), { code: "PROJECT_ALREADY_COMPLETED" });
  state.status = "COMPLETED";
  state.clientApprovedAt = new Date();
  notify();
}

describe("clientApprove — freelancer selection for rating-request notification", () => {
  test("no tasks on the project: no freelancers to notify", () => {
    assert.deepEqual(selectFreelancersToNotify([], "project-1"), []);
  });

  test("task with no assignee: excluded", () => {
    const tasks: Task[] = [{ id: "t1", projectId: "project-1", assignee: null }];
    assert.deepEqual(selectFreelancersToNotify(tasks, "project-1"), []);
  });

  test("task assigned to a CLIENT or MANAGER: excluded (only FREELANCER role counts)", () => {
    const tasks: Task[] = [
      { id: "t1", projectId: "project-1", assignee: { id: "u1", role: "MANAGER", freelancerProfileId: null } },
      { id: "t2", projectId: "project-1", assignee: { id: "u2", role: "CLIENT", freelancerProfileId: null } },
    ];
    assert.deepEqual(selectFreelancersToNotify(tasks, "project-1"), []);
  });

  test("freelancer assignee without a FreelancerProfile: excluded", () => {
    const tasks: Task[] = [{ id: "t1", projectId: "project-1", assignee: { id: "u1", role: "FREELANCER", freelancerProfileId: null } }];
    assert.deepEqual(selectFreelancersToNotify(tasks, "project-1"), []);
  });

  test("single freelancer assigned to one task: included once", () => {
    const tasks: Task[] = [{ id: "t1", projectId: "project-1", assignee: { id: "u1", role: "FREELANCER", freelancerProfileId: "fp1" } }];
    const result = selectFreelancersToNotify(tasks, "project-1");
    assert.equal(result.length, 1);
    assert.equal(result[0].freelancerProfileId, "fp1");
  });

  test("same freelancer assigned to multiple tasks on the project: deduplicated to one entry", () => {
    const tasks: Task[] = [
      { id: "t1", projectId: "project-1", assignee: { id: "u1", role: "FREELANCER", freelancerProfileId: "fp1" } },
      { id: "t2", projectId: "project-1", assignee: { id: "u1", role: "FREELANCER", freelancerProfileId: "fp1" } },
    ];
    const result = selectFreelancersToNotify(tasks, "project-1");
    assert.equal(result.length, 1);
  });

  test("multiple distinct freelancers on the project: all included", () => {
    const tasks: Task[] = [
      { id: "t1", projectId: "project-1", assignee: { id: "u1", role: "FREELANCER", freelancerProfileId: "fp1" } },
      { id: "t2", projectId: "project-1", assignee: { id: "u2", role: "FREELANCER", freelancerProfileId: "fp2" } },
    ];
    const result = selectFreelancersToNotify(tasks, "project-1").map((f) => f.freelancerProfileId).sort();
    assert.deepEqual(result, ["fp1", "fp2"]);
  });

  test("tasks from another project are ignored", () => {
    const tasks: Task[] = [{ id: "t1", projectId: "project-OTHER", assignee: { id: "u1", role: "FREELANCER", freelancerProfileId: "fp1" } }];
    assert.deepEqual(selectFreelancersToNotify(tasks, "project-1"), []);
  });
});

describe("clientApprove — rating-request notification fires exactly once per completed project", () => {
  test("first completion triggers the notification exactly once", () => {
    const state = { status: "REVIEW", clientApprovedAt: null as Date | null };
    let notifyCount = 0;
    runClientApprove(state, () => { notifyCount += 1; });
    assert.equal(notifyCount, 1);
    assert.equal(state.status, "COMPLETED");
  });

  test("calling clientApprove again on an already-completed project throws before notifying again", () => {
    const state = { status: "COMPLETED", clientApprovedAt: new Date() };
    let notifyCount = 0;
    assert.throws(() => runClientApprove(state, () => { notifyCount += 1; }), /PROJECT_ALREADY_APPROVED/);
    assert.equal(notifyCount, 0);
  });

  test("two sequential clientApprove calls on the same project notify exactly once total", () => {
    const state = { status: "REVIEW", clientApprovedAt: null as Date | null };
    let notifyCount = 0;
    runClientApprove(state, () => { notifyCount += 1; });
    assert.throws(() => runClientApprove(state, () => { notifyCount += 1; }));
    assert.equal(notifyCount, 1);
  });
});
