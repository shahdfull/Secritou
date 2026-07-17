// Tests for userService.updateUser session-revocation trigger (RG-019) and
// the last-Admin protection on role change / deletion (RG-021).
// Calls the real userService.updateUser/deleteUser — userRepository/AuthRepository/
// auditLogService/communicationQueue are mocked at the module/prototype level
// (node:test mock), not reimplemented.

import test, { describe, mock, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "a".repeat(32);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "b".repeat(32);
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "secritou-api";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "secritou-web";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

const { userRepository } = await import("../src/repositories/user.repository.js");
const { AuthRepository } = await import("../src/repositories/auth.repository.js");
const { auditLogService } = await import("../src/services/auditLog.service.js");
const { communicationQueue } = await import("../src/jobs/queues.js");
const { userService } = await import("../src/services/user.service.js");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "a@example.com",
    name: "Original Name",
    role: "MANAGER",
    clientId: null,
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("userService.updateUser session revocation (RG-019)", () => {
  let findByIdMock: ReturnType<typeof mock.method>;
  let countByRoleMock: ReturnType<typeof mock.method>;
  let updateMock: ReturnType<typeof mock.method>;
  let revokeMock: ReturnType<typeof mock.method>;
  let auditMock: ReturnType<typeof mock.method>;

  before(() => {
    findByIdMock = mock.method(userRepository, "findById", async () => makeUser());
    countByRoleMock = mock.method(userRepository, "countByRole", async () => 5);
    updateMock = mock.method(userRepository, "update", async (id: string, data: unknown) => ({
      ...makeUser(),
      ...(data as object),
    }));
    revokeMock = mock.method(AuthRepository.prototype, "revokeAllSessionsForUser", async () => ({ count: 1 }));
    auditMock = mock.method(auditLogService, "record", async () => {});
  });

  after(() => {
    mock.restoreAll();
  });

  test("role change triggers revocation", async () => {
    findByIdMock.mock.resetCalls();
    revokeMock.mock.resetCalls();
    auditMock.mock.resetCalls();
    findByIdMock.mock.mockImplementationOnce(async () => makeUser({ role: "MANAGER" }));

    await userService.updateUser("user-1", undefined, "ADMIN", { id: "actor-1", role: "ADMIN" });

    assert.equal(revokeMock.mock.callCount(), 1, "should call revokeAllSessionsForUser");
    assert.equal(revokeMock.mock.calls[0]!.arguments[0], "user-1");
    assert.equal(auditMock.mock.callCount(), 1, "should record USER_ROLE_CHANGED");
  });

  test("name-only update does not trigger revocation", async () => {
    findByIdMock.mock.resetCalls();
    revokeMock.mock.resetCalls();
    auditMock.mock.resetCalls();
    findByIdMock.mock.mockImplementationOnce(async () => makeUser({ role: "MANAGER" }));

    await userService.updateUser("user-1", "New Name", undefined, { id: "actor-1", role: "ADMIN" });

    assert.equal(revokeMock.mock.callCount(), 0, "should not call revokeAllSessionsForUser");
    assert.equal(auditMock.mock.callCount(), 0, "should not record USER_ROLE_CHANGED");
  });

  test("role provided but unchanged does not trigger revocation", async () => {
    findByIdMock.mock.resetCalls();
    revokeMock.mock.resetCalls();
    findByIdMock.mock.mockImplementationOnce(async () => makeUser({ role: "MANAGER" }));

    await userService.updateUser("user-1", undefined, "MANAGER", { id: "actor-1", role: "ADMIN" });

    assert.equal(revokeMock.mock.callCount(), 0, "should not call revokeAllSessionsForUser");
  });
});

describe("userService last-Admin protection (RG-021)", () => {
  let findByIdMock: ReturnType<typeof mock.method>;
  let countByRoleMock: ReturnType<typeof mock.method>;
  let deleteMock: ReturnType<typeof mock.method>;
  let getWaitingMock: ReturnType<typeof mock.method>;
  let auditMock: ReturnType<typeof mock.method>;

  before(() => {
    findByIdMock = mock.method(userRepository, "findById", async () => makeUser({ role: "ADMIN" }));
    countByRoleMock = mock.method(userRepository, "countByRole", async () => 1);
    mock.method(userRepository, "update", async (id: string, data: unknown) => ({
      ...makeUser(),
      ...(data as object),
    }));
    deleteMock = mock.method(userRepository, "delete", async () => makeUser({ role: "ADMIN" }));
    getWaitingMock = mock.method(communicationQueue, "getWaiting", async () => []);
    auditMock = mock.method(auditLogService, "record", async () => {});
  });

  after(() => {
    mock.restoreAll();
  });

  test("updateUser: removing the role of the last Admin throws 409 LAST_ADMIN", async () => {
    findByIdMock.mock.mockImplementationOnce(async () => makeUser({ role: "ADMIN" }));
    countByRoleMock.mock.mockImplementationOnce(async () => 1);

    await assert.rejects(
      () => userService.updateUser("user-1", undefined, "MANAGER", { id: "actor-1", role: "ADMIN" }),
      (err: any) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "LAST_ADMIN");
        return true;
      },
    );
  });

  test("updateUser: changing the role of an Admin is allowed when other Admins exist", async () => {
    findByIdMock.mock.mockImplementationOnce(async () => makeUser({ role: "ADMIN" }));
    countByRoleMock.mock.mockImplementationOnce(async () => 2);

    await assert.doesNotReject(() =>
      userService.updateUser("user-1", undefined, "MANAGER", { id: "actor-1", role: "ADMIN" })
    );
  });

  test("deleteUser: deleting the last Admin throws 409 LAST_ADMIN", async () => {
    findByIdMock.mock.mockImplementationOnce(async () => makeUser({ role: "ADMIN" }));
    countByRoleMock.mock.mockImplementationOnce(async () => 1);

    await assert.rejects(
      () => userService.deleteUser("user-1", { id: "actor-1", role: "ADMIN" }),
      (err: any) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "LAST_ADMIN");
        return true;
      },
    );

    assert.equal(deleteMock.mock.callCount(), 0, "delete must not be called once refused");
  });

  test("deleteUser: deleting an Admin is allowed when other Admins exist", async () => {
    findByIdMock.mock.mockImplementationOnce(async () => makeUser({ role: "ADMIN" }));
    countByRoleMock.mock.mockImplementationOnce(async () => 2);
    deleteMock.mock.resetCalls();
    getWaitingMock.mock.resetCalls();

    await assert.doesNotReject(() => userService.deleteUser("user-1", { id: "actor-1", role: "ADMIN" }));

    assert.equal(deleteMock.mock.callCount(), 1);
  });

  test("deleteUser: deleting a non-Admin never checks the admin count", async () => {
    findByIdMock.mock.mockImplementationOnce(async () => makeUser({ role: "MANAGER" }));
    countByRoleMock.mock.resetCalls();
    deleteMock.mock.resetCalls();

    await assert.doesNotReject(() => userService.deleteUser("user-2", { id: "actor-1", role: "ADMIN" }));

    assert.equal(countByRoleMock.mock.callCount(), 0, "should not count admins for a non-Admin target");
    assert.equal(deleteMock.mock.callCount(), 1);
  });
});
