// Test for RG-013 (project can only reach COMPLETED via clientApprove).
// Calls the real projectService.updateProject — projectRepository is mocked at the
// module level (node:test mock), not reimplemented. Complements
// project.clientApprove.test.ts, which only covers clientApprove's own guards and
// never exercises this refusal path.

import test, { describe, mock, before, after } from "node:test";
import type { HttpError } from "../src/utils/httpError.js";
import assert from "node:assert/strict";

const { projectRepository } = await import("../src/repositories/project.repository.js");
const { projectService } = await import("../src/services/project.service.js");

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-1",
    name: "Test Project",
    status: "REVIEW",
    clientId: "client-1",
    serviceId: null,
    ...overrides,
  };
}

describe("projectService.updateProject blocks COMPLETED (RG-013)", () => {
  let findByIdAdminMock: ReturnType<typeof mock.method>;

  before(() => {
    findByIdAdminMock = mock.method(projectRepository, "findByIdAdmin", async () => makeProject());
    mock.method(projectRepository, "update", async (id: string, data: unknown) => ({
      ...makeProject(),
      ...(data as object),
    }));
  });

  after(() => {
    mock.restoreAll();
  });

  test("rejects status: COMPLETED with 422 COMPLETION_REQUIRES_CLIENT_APPROVAL", async () => {
    findByIdAdminMock.mock.mockImplementationOnce(async () => makeProject({ status: "REVIEW" }));

    await assert.rejects(
      () => projectService.updateProject("project-1", { status: "COMPLETED" }),
      (err: HttpError) => {
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "COMPLETION_REQUIRES_CLIENT_APPROVAL");
        return true;
      },
    );
  });

  test("rejects status: COMPLETED even from a status that could otherwise transition", async () => {
    findByIdAdminMock.mock.mockImplementationOnce(async () => makeProject({ status: "IN_PROGRESS" }));

    await assert.rejects(
      () => projectService.updateProject("project-1", { status: "COMPLETED" }),
      (err: HttpError) => {
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "COMPLETION_REQUIRES_CLIENT_APPROVAL");
        return true;
      },
    );
  });

});

// A third case ("a valid transition succeeds") is intentionally not covered by a call to the
// real updateProject here: on success, updateProject unconditionally reaches invalidateTags()
// (project.service.ts) and, when the status actually changed, also looks up client/assignee
// users to notify — both real Prisma/Redis calls with no reachable mock seam (invalidateTags is
// a plain module function, not mockable via mock.method; prismaRead is a Prisma $extends proxy,
// same issue). The two guard-rejection tests above are the actual behavior under test (RG-013 is
// a refusal rule) and both throw before any of that code runs, so they carry no such side effect.
