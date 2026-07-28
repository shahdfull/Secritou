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
const { serviceService } = await import("../src/services/service.service.js");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "a@example.com",
    name: "Original Name",
    role: "MANAGER",
    clientId: null,
    serviceId: "service-1",
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

    await userService.updateUser("user-1", undefined, "ADMIN", undefined, { id: "actor-1", role: "ADMIN" });

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

    await userService.updateUser("user-1", "New Name", undefined, undefined, { id: "actor-1", role: "ADMIN" });

    assert.equal(revokeMock.mock.callCount(), 0, "should not call revokeAllSessionsForUser");
    assert.equal(revokeAccessTokenMock.mock.callCount(), 0, "should not revoke the access token (SEC-174) on a non-role change");
    assert.equal(auditMock.mock.callCount(), 0, "should not record USER_ROLE_CHANGED");
  });

  test("role provided but unchanged does not trigger revocation", async () => {
    findByIdMock.mock.resetCalls();
    revokeMock.mock.resetCalls();
    revokeAccessTokenMock.mock.resetCalls();
    findByIdMock.mock.mockImplementationOnce(async () => makeUser({ role: "MANAGER" }));

    await userService.updateUser("user-1", undefined, "MANAGER", undefined, { id: "actor-1", role: "ADMIN" });

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
    // Several tests below pass a serviceId through updateUser (SEC-006 validation) — stub
    // existence so this suite stays focused on RG-021, not SEC-006's own validation path.
    mock.method(serviceService, "existsById", async () => true);
  });

  after(() => {
    mock.restoreAll();
  });

  test("updateUser: removing the role of the last Admin throws 409 LAST_ADMIN", async () => {
    findByIdMock.mock.mockImplementationOnce(async () => makeUser({ role: "ADMIN" }));
    countByRoleMock.mock.mockImplementationOnce(async () => 1);

    await assert.rejects(
      () => userService.updateUser("user-1", undefined, "MANAGER", "service-1", { id: "actor-1", role: "ADMIN" }),
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
      userService.updateUser("user-1", undefined, "MANAGER", "service-1", { id: "actor-1", role: "ADMIN" })
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

// SEC-006: a MANAGER's serviceId (pole) must be writable through the real product path —
// userService.inviteUser/updateUser — not only via direct database access.
describe("userService serviceId assignment for MANAGER (SEC-006)", () => {
  let createMock: ReturnType<typeof mock.method>;
  let updateMock: ReturnType<typeof mock.method>;
  let existsByIdMock: ReturnType<typeof mock.method>;

  before(() => {
    mock.method(userRepository, "findByEmail", async () => null);
    mock.method(userRepository, "countByRole", async () => 5);
    createMock = mock.method(userRepository, "create", async (data: Record<string, unknown>) => ({
      ...makeUser(),
      ...data,
    }));
    updateMock = mock.method(userRepository, "update", async (id: string, data: Record<string, unknown>) => ({
      ...makeUser(),
      ...data,
    }));
    existsByIdMock = mock.method(serviceService, "existsById", async () => true);
    mock.method(AuthRepository.prototype, "revokeAllSessionsForUser", async () => ({ count: 1 }));
    mock.method(auditLogService, "record", async () => {});
    mock.method(authDenylist, "revokeAccessToken", async () => {});
  });

  after(() => {
    mock.restoreAll();
  });

  test("inviteUser: a MANAGER invited with a serviceId persists it via userRepository.create", async () => {
    createMock.mock.resetCalls();
    existsByIdMock.mock.resetCalls();

    const user = await userService.inviteUser("m@example.com", "New Manager", "MANAGER", "service-1");

    assert.equal(existsByIdMock.mock.callCount(), 1, "must verify the service exists");
    assert.equal(createMock.mock.callCount(), 1);
    const [createArg] = createMock.mock.calls[0]!.arguments as [Record<string, unknown>];
    assert.equal(createArg.serviceId, "service-1", "serviceId must reach userRepository.create");
    assert.equal(user.serviceId, "service-1", "the returned user must carry the persisted serviceId");
  });

  test("inviteUser: a MANAGER invited without a serviceId is rejected before create is called", async () => {
    createMock.mock.resetCalls();

    await assert.rejects(
      () => userService.inviteUser("m2@example.com", "New Manager", "MANAGER", undefined),
      (err: HttpError) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "SERVICE_ID_REQUIRED");
        return true;
      }
    );
    assert.equal(createMock.mock.callCount(), 0, "must not create the user when serviceId is missing");
  });

  test("inviteUser: a non-MANAGER role does not require a serviceId", async () => {
    createMock.mock.resetCalls();

    await assert.doesNotReject(() => userService.inviteUser("admin2@example.com", "New Admin", "ADMIN", undefined));
    assert.equal(createMock.mock.callCount(), 1);
  });

  test("updateUser: changing an existing MANAGER's serviceId persists the new value via userRepository.update", async () => {
    mock.method(userRepository, "findById", async () => makeUser({ role: "MANAGER", serviceId: "service-old" }));
    updateMock.mock.resetCalls();
    existsByIdMock.mock.resetCalls();

    const user = await userService.updateUser("user-1", undefined, undefined, "service-1", {
      id: "actor-1",
      role: "ADMIN",
    });

    assert.equal(existsByIdMock.mock.callCount(), 1, "must verify the new service exists");
    assert.equal(updateMock.mock.callCount(), 1);
    const [, updateArg] = updateMock.mock.calls[0]!.arguments as [string, Record<string, unknown>];
    assert.equal(updateArg.serviceId, "service-1", "the new serviceId must reach userRepository.update");
    assert.equal(user.serviceId, "service-1", "the returned user must carry the persisted serviceId");
  });

  test("updateUser: promoting a user to MANAGER without any serviceId (new or existing) is rejected", async () => {
    mock.method(userRepository, "findById", async () => makeUser({ role: "CLIENT", serviceId: null }));
    updateMock.mock.resetCalls();

    await assert.rejects(
      () => userService.updateUser("user-1", undefined, "MANAGER", undefined, { id: "actor-1", role: "ADMIN" }),
      (err: HttpError) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "SERVICE_ID_REQUIRED");
        return true;
      }
    );
    assert.equal(updateMock.mock.callCount(), 0);
  });

  test("updateUser: demoting a MANAGER to CLIENT clears serviceId", async () => {
    mock.method(userRepository, "findById", async () => makeUser({ role: "MANAGER", serviceId: "service-1" }));
    updateMock.mock.resetCalls();

    const user = await userService.updateUser("user-1", undefined, "CLIENT", undefined, {
      id: "actor-1",
      role: "ADMIN",
    });

    const [, updateArg] = updateMock.mock.calls[0]!.arguments as [string, Record<string, unknown>];
    assert.equal(updateArg.serviceId, null, "serviceId must be cleared once the role is no longer MANAGER");
    assert.equal(user.serviceId, null);
  });
});
