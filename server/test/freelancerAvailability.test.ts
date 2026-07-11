// Tests for task.service.checkFreelancerAvailability : no DB, no real imports.
// Pattern (matches proposalAcceptCascade.test.ts): mirror the service's Prisma query logic
// against an in-memory fake store of tasks, and assert the overlap detection is correct.
// Source: src/services/task.service.ts (checkFreelancerAvailability)
//
// Overlap rule mirrored from the real query: both boundaries inclusive —
//   task.startDate <= endDate AND task.dueDate >= startDate
// A task missing startDate or dueDate is excluded (not assignment-checkable).

import test, { describe } from "node:test";
import assert from "node:assert/strict";

type FakeTask = {
  id: string;
  title: string;
  assigneeId: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  projectId: string;
  projectName: string | null;
};

function d(s: string) {
  return new Date(s);
}

function checkFreelancerAvailability(
  tasks: FakeTask[],
  freelancerId: string,
  startDate: Date,
  endDate: Date,
  excludeTaskId?: string
) {
  return tasks
    .filter((t) => t.assigneeId === freelancerId)
    .filter((t) => !excludeTaskId || t.id !== excludeTaskId)
    .filter((t) => t.startDate !== null && t.dueDate !== null)
    .filter((t) => t.startDate! <= endDate && t.dueDate! >= startDate)
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      startDate: t.startDate!,
      dueDate: t.dueDate!,
      projectId: t.projectId,
      projectName: t.projectName,
    }));
}

const FREELANCER = "freelancer-1";
const OTHER_FREELANCER = "freelancer-2";

function makeTask(overrides: Partial<FakeTask> = {}): FakeTask {
  return {
    id: "task-1",
    title: "Design homepage",
    assigneeId: FREELANCER,
    startDate: d("2026-06-01"),
    dueDate: d("2026-06-10"),
    projectId: "project-1",
    projectName: "Site vitrine",
    ...overrides,
  };
}

describe("task.service.checkFreelancerAvailability", () => {
  test("no other assignments: returns no conflicts", () => {
    const conflicts = checkFreelancerAvailability([], FREELANCER, d("2026-06-01"), d("2026-06-10"));
    assert.deepEqual(conflicts, []);
  });

  test("non-overlapping dates (fully before): no conflict", () => {
    const tasks = [makeTask({ startDate: d("2026-05-01"), dueDate: d("2026-05-10") })];
    const conflicts = checkFreelancerAvailability(tasks, FREELANCER, d("2026-06-01"), d("2026-06-10"));
    assert.equal(conflicts.length, 0);
  });

  test("non-overlapping dates (fully after): no conflict", () => {
    const tasks = [makeTask({ startDate: d("2026-07-01"), dueDate: d("2026-07-10") })];
    const conflicts = checkFreelancerAvailability(tasks, FREELANCER, d("2026-06-01"), d("2026-06-10"));
    assert.equal(conflicts.length, 0);
  });

  test("different freelancer with overlapping dates: no conflict (not the same person)", () => {
    const tasks = [makeTask({ assigneeId: OTHER_FREELANCER })];
    const conflicts = checkFreelancerAvailability(tasks, FREELANCER, d("2026-06-01"), d("2026-06-10"));
    assert.equal(conflicts.length, 0);
  });

  test("unassigned task with overlapping dates: no conflict", () => {
    const tasks = [makeTask({ assigneeId: null })];
    const conflicts = checkFreelancerAvailability(tasks, FREELANCER, d("2026-06-01"), d("2026-06-10"));
    assert.equal(conflicts.length, 0);
  });

  test("task missing startDate or dueDate is never a conflict (not checkable)", () => {
    const tasks = [
      makeTask({ id: "t1", startDate: null }),
      makeTask({ id: "t2", dueDate: null }),
    ];
    const conflicts = checkFreelancerAvailability(tasks, FREELANCER, d("2026-06-01"), d("2026-06-10"));
    assert.equal(conflicts.length, 0);
  });

  test("exact boundary touch: existing task ends exactly when new range starts — counts as overlap (inclusive)", () => {
    const tasks = [makeTask({ startDate: d("2026-05-20"), dueDate: d("2026-06-01") })];
    const conflicts = checkFreelancerAvailability(tasks, FREELANCER, d("2026-06-01"), d("2026-06-10"));
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].taskId, "task-1");
  });

  test("exact boundary touch: existing task starts exactly when new range ends — counts as overlap (inclusive)", () => {
    const tasks = [makeTask({ startDate: d("2026-06-10"), dueDate: d("2026-06-20") })];
    const conflicts = checkFreelancerAvailability(tasks, FREELANCER, d("2026-06-01"), d("2026-06-10"));
    assert.equal(conflicts.length, 1);
  });

  test("full containment: existing task is entirely inside the new range", () => {
    const tasks = [makeTask({ startDate: d("2026-06-03"), dueDate: d("2026-06-05") })];
    const conflicts = checkFreelancerAvailability(tasks, FREELANCER, d("2026-06-01"), d("2026-06-10"));
    assert.equal(conflicts.length, 1);
  });

  test("full containment: new range is entirely inside the existing task's range", () => {
    const tasks = [makeTask({ startDate: d("2026-05-01"), dueDate: d("2026-07-01") })];
    const conflicts = checkFreelancerAvailability(tasks, FREELANCER, d("2026-06-01"), d("2026-06-10"));
    assert.equal(conflicts.length, 1);
  });

  test("partial overlap: existing task starts before and ends inside the new range", () => {
    const tasks = [makeTask({ startDate: d("2026-05-25"), dueDate: d("2026-06-05") })];
    const conflicts = checkFreelancerAvailability(tasks, FREELANCER, d("2026-06-01"), d("2026-06-10"));
    assert.equal(conflicts.length, 1);
  });

  test("partial overlap: existing task starts inside and ends after the new range", () => {
    const tasks = [makeTask({ startDate: d("2026-06-05"), dueDate: d("2026-06-15") })];
    const conflicts = checkFreelancerAvailability(tasks, FREELANCER, d("2026-06-01"), d("2026-06-10"));
    assert.equal(conflicts.length, 1);
  });

  test("excludeTaskId omits the task being edited from its own conflict check", () => {
    const tasks = [makeTask({ id: "task-1", startDate: d("2026-06-03"), dueDate: d("2026-06-05") })];
    const conflicts = checkFreelancerAvailability(tasks, FREELANCER, d("2026-06-01"), d("2026-06-10"), "task-1");
    assert.equal(conflicts.length, 0);
  });

  test("multiple overlapping tasks are all returned, non-overlapping ones excluded", () => {
    const tasks = [
      makeTask({ id: "t1", startDate: d("2026-06-02"), dueDate: d("2026-06-04") }),
      makeTask({ id: "t2", startDate: d("2026-05-01"), dueDate: d("2026-05-10") }), // no overlap
      makeTask({ id: "t3", startDate: d("2026-06-08"), dueDate: d("2026-06-20") }),
    ];
    const conflicts = checkFreelancerAvailability(tasks, FREELANCER, d("2026-06-01"), d("2026-06-10"));
    const ids = conflicts.map((c) => c.taskId).sort();
    assert.deepEqual(ids, ["t1", "t3"]);
  });

  test("conflict shape includes task/project info for the UI message", () => {
    const tasks = [makeTask({ title: "Refonte SEO", projectName: "Acme Corp" })];
    const conflicts = checkFreelancerAvailability(tasks, FREELANCER, d("2026-06-01"), d("2026-06-10"));
    assert.equal(conflicts[0].title, "Refonte SEO");
    assert.equal(conflicts[0].projectName, "Acme Corp");
    assert.ok(conflicts[0].startDate instanceof Date);
    assert.ok(conflicts[0].dueDate instanceof Date);
  });
});
