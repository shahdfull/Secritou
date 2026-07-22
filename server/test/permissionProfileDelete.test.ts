
// Tests for permissionProfileService.delete (SEC-114)
import test, { describe, mock, before, after } from "node:test";
import type { HttpError } from "../src/utils/httpError.js";
import assert from "node:assert/strict";

const { permissionProfileRepository } = await import("../src/repositories/permissionProfile.repository.js");
const { managerPermissionRepository } = await import("../src/repositories/managerPermission.repository.js");
const { auditLogService } = await import("../src/services/auditLog.service.js");
const { permissionProfileService } = await import("../src/services/managerPermission.service.js");

function makePermissionProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "profile-1",
    name: "Test Profile",
    description: "Test Description",
    permissions: {},
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("permissionProfileService.delete (SEC-114)", () => {
  let findProfileByIdMock: ReturnType<typeof mock.method>;
  let findManagersByProfileIdMock: ReturnType<typeof mock.method>;
  let deleteProfileMock: ReturnType<typeof mock.method>;
  let auditMock: ReturnType<typeof mock.method>;

  before(() => {
    findProfileByIdMock = mock.method(permissionProfileRepository, "findById", async () => makePermissionProfile());
    findManagersByProfileIdMock = mock.method(managerPermissionRepository, "findManagersByProfileId", async () => []);
    deleteProfileMock = mock.method(permissionProfileRepository, "delete", async () => makePermissionProfile());
    auditMock = mock.method(auditLogService, "record", async () => {});
  });

  after(() => {
    mock.restoreAll();
  });

  test("delete without managers and without force succeeds", async () => {
    findProfileByIdMock.mock.resetCalls();
    findManagersByProfileIdMock.mock.resetCalls();
    deleteProfileMock.mock.resetCalls();
    auditMock.mock.resetCalls();

    findManagersByProfileIdMock.mock.mockImplementationOnce(async () => []);

    await assert.doesNotReject(() => permissionProfileService.delete("profile-1"));
    assert.equal(deleteProfileMock.mock.callCount(), 1);
    assert.equal(auditMock.mock.callCount(), 1);
  });

  test("delete with managers and with force succeeds, invalidates caches, and records audit log with affected managers", async () => {
    findProfileByIdMock.mock.resetCalls();
    findManagersByProfileIdMock.mock.resetCalls();
    deleteProfileMock.mock.resetCalls();
    auditMock.mock.resetCalls();

    findManagersByProfileIdMock.mock.mockImplementationOnce(async () => [
      { userId: "user-1", userName: "Manager One" },
      { userId: "user-2", userName: "Manager Two" },
    ]);

    await assert.doesNotReject(() =>
      permissionProfileService.delete("profile-1", {
        force: true,
        actorId: "actor-1",
        ipAddress: "127.0.0.1",
      })
    );

    assert.equal(deleteProfileMock.mock.callCount(), 1, "should call delete when forced");
    assert.equal(auditMock.mock.callCount(), 1, "should record audit log");
    const auditLogCall = auditMock.mock.calls[0]!.arguments[0] as any;
    assert.equal(auditLogCall.action, "delete");
    assert.equal(auditLogCall.entityType, "PermissionProfile");
    assert.equal(auditLogCall.entityId, "profile-1");
    assert.deepEqual(auditLogCall.before.attachedManagers, [
      { userId: "user-1", userName: "Manager One" },
      { userId: "user-2", userName: "Manager Two" },
    ]);
    assert.deepEqual(auditLogCall.after, {
      deleted: true,
      detachedManagers: [
        { userId: "user-1", userName: "Manager One" },
        { userId: "user-2", userName: "Manager Two" },
      ],
    });
  });

  test("delete with managers is blocked by default", async () => {
    findManagersByProfileIdMock.mock.resetCalls();
    deleteProfileMock.mock.resetCalls();
    findManagersByProfileIdMock.mock.mockImplementationOnce(async () => [
      { userId: "user-1", userName: "Manager One" },
      { userId: "user-2", userName: "Manager Two" },
    ]);

    await assert.rejects(
      () => permissionProfileService.delete("profile-1"),
      (err: HttpError) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "PERMISSION_PROFILE_IN_USE");
        assert.match(err.message, /2 manager\(s\)/);
        assert.match(err.message, /Manager One/);
        assert.match(err.message, /Manager Two/);
        return true;
      },
    );

    assert.equal(deleteProfileMock.mock.callCount(), 0, "should not call delete if not forced");
  });
});
