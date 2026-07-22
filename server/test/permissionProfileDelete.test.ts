
// Tests for permissionProfileService.delete (SEC-114)
import test, { describe, mock, before, after } from "node:test";
import type { HttpError } from "../src/utils/httpError.js";
import type { AuditLogEntry } from "../src/services/auditLog.service.js";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let realDbAvailable = true;
const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];

const { permissionProfileRepository } = await import("../src/repositories/permissionProfile.repository.js");
const { managerPermissionRepository } = await import("../src/repositories/managerPermission.repository.js");
const { auditLogService } = await import("../src/services/auditLog.service.js");
const { permissionProfileService, managerPermissionService } = await import("../src/services/managerPermission.service.js");

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
    const auditLogCall = auditMock.mock.calls[0]!.arguments[0] as AuditLogEntry;
    assert.equal(auditLogCall.action, "delete");
    assert.equal(auditLogCall.entityType, "PermissionProfile");
    assert.equal(auditLogCall.entityId, "profile-1");
    assert.deepEqual((auditLogCall.before as { attachedManagers: unknown })?.attachedManagers, [
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

// The suite above mocks every repository, so it never proves the real end-to-end consequence
// SEC-114's own criterion names explicitly: "vérifie que la permission de ce manager n'est pas
// silencieusement vidée" versus the pre-fix behavior where resolvePermissions fell back to
// base = {} with no signal at all. This uses the real repositories, a real cache (Redis), and
// the real resolvePermissions — not a reimplementation — to prove the manager's permissions are
// gone (empty, not the old profile's grants) but non-silently: the delete call is only reachable
// with an explicit force, and its outcome (empty permissions) is observable and expected, not a
// crash or a silent stale cache. Requires a real database/Redis; skipped if unreachable.
before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    realDbAvailable = false;
  }
});

after(async () => {
  if (!realDbAvailable) return;
  await prisma.managerPermission.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.permissionProfile.deleteMany({ where: { id: { in: createdProfileIds } } });
});

test("force-deleting a profile actually empties the attached manager's resolved permissions, non-silently (SEC-114, real cache)", { skip: !realDbAvailable ? "no reachable database/redis" : false }, async () => {
  const profile = await prisma.permissionProfile.create({
    data: {
      name: `sec114-profile-${Date.now()}`,
      permissions: { projects: { read: true, update: true } },
    },
  });
  createdProfileIds.push(profile.id);

  const manager = await prisma.user.create({
    data: {
      email: `sec114-manager-${Date.now()}@test.local`,
      name: "SEC-114 test manager",
      passwordHash: "x",
      role: "MANAGER",
    },
  });
  createdUserIds.push(manager.id);

  await prisma.managerPermission.create({ data: { userId: manager.id, profileId: profile.id } });

  // Populate the cache with the profile's real grants before deletion, exactly as a live
  // request would (authorize/requirePermission calls resolvePermissions on every request).
  const before = await managerPermissionService.resolvePermissions(manager.id);
  assert.equal(before.projects?.update, true, "the manager must see the profile's real grant before deletion");

  // Blocked by default (non-silent: the caller gets an explicit 409, not a silent success).
  await assert.rejects(
    () => permissionProfileService.delete(profile.id),
    (err: HttpError) => {
      assert.equal(err.statusCode, 409);
      assert.equal(err.code, "PERMISSION_PROFILE_IN_USE");
      assert.match(err.message, /SEC-114 test manager/);
      return true;
    },
  );

  // Still attached: the cache must be untouched by the refused attempt.
  const stillAttached = await managerPermissionService.resolvePermissions(manager.id);
  assert.equal(stillAttached.projects?.update, true, "a refused delete must not affect the manager's permissions at all");

  // Force-delete: explicit confirmation, not a silent side effect of some other action.
  await permissionProfileService.delete(profile.id, { force: true, actorId: "sec114-test-actor" });

  const after = await managerPermissionService.resolvePermissions(manager.id);
  assert.equal(after.projects?.update, undefined, "the manager's permissions must actually be empty after a forced delete (cache real-invalidated, not stale)");
});
