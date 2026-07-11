// Tests for project.service.clientApprove's unresolved-approvals guard (PENDING or REJECTED) :
// no DB, no real imports. Pattern (matches proposalAcceptCascade.test.ts): mirror the service's
// pre-transaction checks against in-memory fakes, and assert the guard blocks completion until
// every Approval is APPROVED.
// Source: src/services/project.service.ts (clientApprove)

import test, { describe } from "node:test";
import assert from "node:assert/strict";

type Project = {
  id: string;
  clientId: string;
  status: string;
  clientApprovedAt: Date | null;
};

type Approval = { id: string; projectId: string; status: "PENDING" | "APPROVED" | "REJECTED" };

function makeWorld(opts: {
  project?: Partial<Project>;
  openTasks?: number;
  depositPaid?: boolean;
  approvals?: Approval[];
} = {}) {
  const project: Project = {
    id: "project-1",
    clientId: "client-1",
    status: "REVIEW",
    clientApprovedAt: null,
    ...opts.project,
  };
  const state = {
    project,
    openTasks: opts.openTasks ?? 0,
    depositInvoice: { status: opts.depositPaid ?? true ? "PAID" : "PENDING" },
    approvals: opts.approvals ?? [],
  };
  return { state };
}

// Mirrors the guard order in clientApprove: already-approved -> already-completed -> open tasks
// -> deposit unpaid -> pending approvals. Throws with the same error codes the real service uses.
async function runClientApproveGuards(world: ReturnType<typeof makeWorld>, clientId = "client-1") {
  const { state } = world;
  if (state.project.clientId !== clientId) throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
  if (state.project.clientApprovedAt) throw Object.assign(new Error("PROJECT_ALREADY_APPROVED"), { code: "PROJECT_ALREADY_APPROVED" });
  if (state.project.status === "COMPLETED") throw Object.assign(new Error("PROJECT_ALREADY_COMPLETED"), { code: "PROJECT_ALREADY_COMPLETED" });
  if (state.openTasks > 0) throw Object.assign(new Error("OPEN_TASKS_REMAINING"), { code: "OPEN_TASKS_REMAINING" });
  if (state.depositInvoice && state.depositInvoice.status !== "PAID") {
    throw Object.assign(new Error("DEPOSIT_UNPAID"), { code: "DEPOSIT_UNPAID" });
  }
  const unresolvedApprovals = state.approvals.filter((a) => a.status === "PENDING" || a.status === "REJECTED").length;
  if (unresolvedApprovals > 0) {
    throw Object.assign(new Error("PENDING_APPROVALS_REMAINING"), { code: "PENDING_APPROVALS_REMAINING", unresolvedApprovals });
  }

  state.project.status = "COMPLETED";
  state.project.clientApprovedAt = new Date();
  return { project: state.project };
}

describe("project.service.clientApprove — unresolved approvals guard", () => {
  test("blocks completion when a PENDING approval is linked to the project", async () => {
    const world = makeWorld({ approvals: [{ id: "a1", projectId: "project-1", status: "PENDING" }] });
    await assert.rejects(() => runClientApproveGuards(world), /PENDING_APPROVALS_REMAINING/);
    assert.equal(world.state.project.status, "REVIEW");
    assert.equal(world.state.project.clientApprovedAt, null);
  });

  test("succeeds when all approvals are APPROVED", async () => {
    const world = makeWorld({
      approvals: [
        { id: "a1", projectId: "project-1", status: "APPROVED" },
        { id: "a2", projectId: "project-1", status: "APPROVED" },
      ],
    });
    const res = await runClientApproveGuards(world);
    assert.equal(res.project.status, "COMPLETED");
    assert.ok(res.project.clientApprovedAt);
  });

  test("blocks completion when a REJECTED approval is linked to the project", async () => {
    const world = makeWorld({ approvals: [{ id: "a1", projectId: "project-1", status: "REJECTED" }] });
    await assert.rejects(() => runClientApproveGuards(world), /PENDING_APPROVALS_REMAINING/);
    assert.equal(world.state.project.status, "REVIEW");
    assert.equal(world.state.project.clientApprovedAt, null);
  });

  test("succeeds when there are no approvals at all", async () => {
    const world = makeWorld();
    const res = await runClientApproveGuards(world);
    assert.equal(res.project.status, "COMPLETED");
  });

  test("open tasks still block before the approvals check is reached", async () => {
    const world = makeWorld({ openTasks: 2, approvals: [{ id: "a1", projectId: "project-1", status: "PENDING" }] });
    await assert.rejects(() => runClientApproveGuards(world), /OPEN_TASKS_REMAINING/);
  });

  test("unpaid deposit still blocks before the approvals check is reached", async () => {
    const world = makeWorld({ depositPaid: false, approvals: [{ id: "a1", projectId: "project-1", status: "PENDING" }] });
    await assert.rejects(() => runClientApproveGuards(world), /DEPOSIT_UNPAID/);
  });
});
