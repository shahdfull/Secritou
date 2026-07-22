// Tests for userService.updateUser session-revocation trigger (RG-019) and
// the last-Admin protection on role change / deletion (RG-021).
// Calls the real userService.updateUser/deleteUser — userRepository/AuthRepository/
// auditLogService/communicationQueue are mocked at the module/prototype level
// (node:test mock), not reimplemented.

import test, { describe, mock, before, after } from "node:test";
import type { HttpError } from "../src/utils/httpError.js";
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
const { authDenylist } = await import("../src/cache/authDenylist.js");

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
  let revokeMock: ReturnType<typeof mock.method>;
  let revokeAccessTokenMock: ReturnType<typeof mock.method>;
  let auditMock: ReturnType<typeof mock.method>;

  before(() => {
    findByIdMock = mock.method(userRepository, "findById", async () => makeUser());
    // countByRole/update are stubbed for their side effect only; their handles are never read here.
    mock.method(userRepository, "countByRole", async () => 5);
    mock.method(userRepository, "update", async (id: string, data: unknown) => ({
      ...makeUser(),
      ...(data as object),
    }));
    revokeMock = mock.method(AuthRepository.prototype, "revokeAllSessionsForUser", async () => ({ count: 1 }));
    auditMock = mock.method(auditLogService, "record", async () => {});
    // userService.updateUser also calls the real authDenylist.revokeAccessToken (SEC-174) — mocked
    // here so this suite's literal "user-1" sub never actually writes to Redis, which would leak
    // a real revocation across test files sharing that same literal sub (see authDenylist.test.ts).
    // Its call is asserted below (not just stubbed): SEC-174 revoking the still-valid 15-minute
    // access token has no value if updateUser stops calling it, so a silent removal must fail here.
    revokeAccessTokenMock = mock.method(authDenylist, "revokeAccessToken", async () => {});
  });

  after(() => {
    mock.restoreAll();
  });

  test("role change triggers revocation", async () => {
    findByIdMock.mock.resetCalls();
    revokeMock.mock.resetCalls();
    revokeAccessTokenMock.mock.resetCalls();
    auditMock.mock.resetCalls();
    findByIdMock.mock.mockImplementationOnce(async () => makeUser({ role: "MANAGER" }));

    await userService.updateUser("user-1", undefined, "ADMIN", { id: "actor-1", role: "ADMIN" });

    assert.equal(revokeMock.mock.callCount(), 1, "should call revokeAllSessionsForUser");
    assert.equal(revokeMock.mock.calls[0]!.arguments[0], "user-1");
    assert.equal(revokeAccessTokenMock.mock.callCount(), 1, "should also revoke the already-issued access token (SEC-174)");
    assert.deepEqual(revokeAccessTokenMock.mock.calls[0]!.arguments[0], { sub: "user-1" });
    assert.equal(auditMock.mock.callCount(), 1, "should record USER_ROLE_CHANGED");
  });

  test("name-only update does not trigger revocation", async () => {
    findByIdMock.mock.resetCalls();
    revokeMock.mock.resetCalls();
    revokeAccessTokenMock.mock.resetCalls();
    auditMock.mock.resetCalls();
    findByIdMock.mock.mockImplementationOnce(async () => makeUser({ role: "MANAGER" }));

    await userService.updateUser("user-1", "New Name", undefined, { id: "actor-1", role: "ADMIN" });

    assert.equal(revokeMock.mock.callCount(), 0, "should not call revokeAllSessionsForUser");
    assert.equal(revokeAccessTokenMock.mock.callCount(), 0, "should not revoke the access token (SEC-174) on a non-role change");
    assert.equal(auditMock.mock.callCount(), 0, "should not record USER_ROLE_CHANGED");
  });

  test("role provided but unchanged does not trigger revocation", async () => {
    findByIdMock.mock.resetCalls();
    revokeMock.mock.resetCalls();
    revokeAccessTokenMock.mock.resetCalls();
    findByIdMock.mock.mockImplementationOnce(async () => makeUser({ role: "MANAGER" }));

    await userService.updateUser("user-1", undefined, "MANAGER", { id: "actor-1", role: "ADMIN" });

    assert.equal(revokeMock.mock.callCount(), 0, "should not call revokeAllSessionsForUser");
    assert.equal(revokeAccessTokenMock.mock.callCount(), 0, "should not revoke the access token (SEC-174) when the role is unchanged");
  });
});

describe("userService last-Admin protection (RG-021)", () => {
  let findByIdMock: ReturnType<typeof mock.method>;
  let countByRoleMock: ReturnType<typeof mock.method>;
  let deleteMock: ReturnType<typeof mock.method>;
  let getWaitingMock: ReturnType<typeof mock.method>;
  let revokeAccessTokenMock: ReturnType<typeof mock.method>;

  before(() => {
    findByIdMock = mock.method(userRepository, "findById", async () => makeUser({ role: "ADMIN" }));
    countByRoleMock = mock.method(userRepository, "countByRole", async () => 1);
    mock.method(userRepository, "update", async (id: string, data: unknown) => ({
      ...makeUser(),
      ...(data as object),
    }));
    deleteMock = mock.method(userRepository, "delete", async () => makeUser({ role: "ADMIN" }));
    getWaitingMock = mock.method(communicationQueue, "getWaiting", async () => []);
    // audit record stubbed for its side effect only; the handle is never read in this block.
    mock.method(auditLogService, "record", async () => {});
    // userService.deleteUser also calls the real authDenylist.revokeAccessToken (SEC-174) — same
    // reason as the RG-019 block above: keep this suite's literal "user-1" sub out of real Redis.
    // Its call is asserted below on the successful-delete tests (not just stubbed): revoking a
    // deleted user's still-valid access token has no value if deleteUser stops calling it.
    revokeAccessTokenMock = mock.method(authDenylist, "revokeAccessToken", async () => {});
  });

  after(() => {
    mock.restoreAll();
  });

  test("updateUser: removing the role of the last Admin throws 409 LAST_ADMIN", async () => {
    findByIdMock.mock.mockImplementationOnce(async () => makeUser({ role: "ADMIN" }));
    countByRoleMock.mock.mockImplementationOnce(async () => 1);

    await assert.rejects(
      () => userService.updateUser("user-1", undefined, "MANAGER", { id: "actor-1", role: "ADMIN" }),
      (err: HttpError) => {
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
    revokeAccessTokenMock.mock.resetCalls();

    await assert.rejects(
      () => userService.deleteUser("user-1", { id: "actor-1", role: "ADMIN" }),
      (err: HttpError) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "LAST_ADMIN");
        return true;
      },
    );

    assert.equal(deleteMock.mock.callCount(), 0, "delete must not be called once refused");
    assert.equal(revokeAccessTokenMock.mock.callCount(), 0, "must not revoke a token for a delete that never happened");
  });

  test("deleteUser: deleting an Admin is allowed when other Admins exist", async () => {
    findByIdMock.mock.mockImplementationOnce(async () => makeUser({ role: "ADMIN" }));
    countByRoleMock.mock.mockImplementationOnce(async () => 2);
    deleteMock.mock.resetCalls();
    getWaitingMock.mock.resetCalls();
    revokeAccessTokenMock.mock.resetCalls();

    await assert.doesNotReject(() => userService.deleteUser("user-1", { id: "actor-1", role: "ADMIN" }));

    assert.equal(deleteMock.mock.callCount(), 1);
    assert.equal(revokeAccessTokenMock.mock.callCount(), 1, "should revoke the deleted user's access token (SEC-174)");
    assert.deepEqual(revokeAccessTokenMock.mock.calls[0]!.arguments[0], { sub: "user-1" });
  });

  test("deleteUser: deleting a non-Admin never checks the admin count", async () => {
    findByIdMock.mock.mockImplementationOnce(async () => makeUser({ role: "MANAGER" }));
    countByRoleMock.mock.resetCalls();
    deleteMock.mock.resetCalls();
    revokeAccessTokenMock.mock.resetCalls();

    await assert.doesNotReject(() => userService.deleteUser("user-2", { id: "actor-1", role: "ADMIN" }));

    assert.equal(countByRoleMock.mock.callCount(), 0, "should not count admins for a non-Admin target");
    assert.equal(deleteMock.mock.callCount(), 1);
    assert.equal(revokeAccessTokenMock.mock.callCount(), 1, "should revoke the deleted user's access token (SEC-174)");
    assert.deepEqual(revokeAccessTokenMock.mock.calls[0]!.arguments[0], { sub: "user-2" });
  });
});

describe("userService.updateMe phone write/read/clear (SEC-006)", () => {
  let updateMeMock: ReturnType<typeof mock.method>;

  before(() => {
    // findById stubbed for its side effect only; the handle is never read in this block.
    mock.method(userRepository, "findById", async () => makeUser());
    // Mirrors the real repository: `data` is passed straight to `prisma.user.update`,
    // so whatever was written is exactly what a subsequent read would return.
    updateMeMock = mock.method(userRepository, "updateMe", async (id: string, data: Record<string, unknown>) => ({
      ...makeUser(),
      phone: "phone" in data ? data.phone : undefined,
    }));
  });

  after(() => {
    mock.restoreAll();
  });

  test("writing a phone number persists it and it is read back unchanged", async () => {
    const result = await userService.updateMe("user-1", { phone: "+216 12 345 678" });

    assert.equal(updateMeMock.mock.callCount(), 1);
    const [, dataArg] = updateMeMock.mock.calls[0]!.arguments as [string, Record<string, unknown>];
    assert.equal(dataArg.phone, "+216 12 345 678", "the exact value written must reach the repository");
    assert.equal(result.phone, "+216 12 345 678", "the value returned to the caller (and re-displayed) must match");
  });

  test("submitting an empty phone clears it (writes null, not omitted)", async () => {
    const result = await userService.updateMe("user-1", { phone: null });

    const [, dataArg] = updateMeMock.mock.calls[updateMeMock.mock.callCount() - 1]!.arguments as [string, Record<string, unknown>];
    assert.equal(dataArg.phone, null, "clearing the field must write an explicit null, not omit the key");
    assert.equal(result.phone, null, "the number must actually be gone, not silently kept");
  });

  test("omitting phone entirely (e.g. a name-only update) does not touch the stored value", async () => {
    await userService.updateMe("user-1", { name: "New Name" });

    const [, dataArg] = updateMeMock.mock.calls[updateMeMock.mock.callCount() - 1]!.arguments as [string, Record<string, unknown>];
    assert.ok(!("phone" in dataArg), "phone must be absent from the update payload, not sent as undefined/null");
  });
});
