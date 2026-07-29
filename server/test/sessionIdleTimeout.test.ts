// RG-020 : le seuil d'inactivité de session (jadis SESSION_IDLE_TIMEOUT_MINUTES codé en
// dur à 3) est maintenant lu depuis AppSetting (clé "sessionIdleTimeoutMinutes"), avec
// repli sur DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES si absent. Ce test importe et appelle le
// vrai repository/service contre une base migrée — pas une réimplémentation de la logique
// de cutoff — pour rester rouge si le code réel dérive.
//
// Requires a real database (DATABASE_URL); skipped automatically if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "a".repeat(32);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "b".repeat(32);
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

let prisma: typeof import("../src/config/prisma.js").prisma;
let userSessionRepository: typeof import("../src/repositories/userSession.repository.js").userSessionRepository;
let getSessionIdleTimeoutMinutes: typeof import("../src/repositories/userSession.repository.js").getSessionIdleTimeoutMinutes;
let DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES: number;
let SESSION_IDLE_TIMEOUT_MINUTES_KEY: string;
let userService: typeof import("../src/services/user.service.js").userService;
let dbAvailable = true;

let userId: string;
let actorId: string;

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({
      userSessionRepository,
      getSessionIdleTimeoutMinutes,
      DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES,
      SESSION_IDLE_TIMEOUT_MINUTES_KEY,
    } = await import("../src/repositories/userSession.repository.js"));
    ({ userService } = await import("../src/services/user.service.js"));
    await prisma.$queryRaw`SELECT 1`;

    const service = await prisma.service.findFirst();
    if (!service) throw new Error("no Service seeded");

    const passwordHash = "x".repeat(60);
    const user = await prisma.user.create({
      data: { name: "RG-020 test user", email: `rg020-${Date.now()}@test.local`, passwordHash, role: "MANAGER", serviceId: service.id },
    });
    userId = user.id;
    const actor = await prisma.user.create({
      data: { name: "RG-020 test admin", email: `rg020-admin-${Date.now()}@test.local`, passwordHash, role: "ADMIN" },
    });
    actorId = actor.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.appSetting.deleteMany({ where: { key: SESSION_IDLE_TIMEOUT_MINUTES_KEY } });
  await prisma.userSession.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, actorId] } } });
});

describe("RG-020 — session idle timeout is configurable via AppSetting", () => {
  test("falls back to DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES when no AppSetting row exists", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    await prisma.appSetting.deleteMany({ where: { key: SESSION_IDLE_TIMEOUT_MINUTES_KEY } });

    const minutes = await getSessionIdleTimeoutMinutes();
    assert.equal(minutes, DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES);
  });

  test("userService.updateSessionIdleTimeoutMinutes persists the value and getSessionIdleTimeoutMinutes reflects it", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }

    await userService.updateSessionIdleTimeoutMinutes(45, actorId);
    const minutes = await getSessionIdleTimeoutMinutes();
    assert.equal(minutes, 45);

    const row = await prisma.appSetting.findUnique({ where: { key: SESSION_IDLE_TIMEOUT_MINUTES_KEY } });
    assert.equal(row?.updatedByUserId, actorId, "the acting ADMIN must be recorded on the setting row");
  });

  test("a heartbeat within the configured window extends the same session instead of opening a new one", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    await userService.updateSessionIdleTimeoutMinutes(1, actorId);

    await userSessionRepository.recordHeartbeat(userId);
    const first = await prisma.userSession.findFirst({ where: { userId }, orderBy: { startedAt: "desc" } });
    assert.ok(first);

    await userSessionRepository.recordHeartbeat(userId);
    const sessions = await prisma.userSession.findMany({ where: { userId } });
    assert.equal(sessions.length, 1, "second heartbeat within the 1-minute window must extend the existing session, not create a second one");
  });

  test("closeStaleSessions closes a session whose last heartbeat is older than the configured window", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    await userService.updateSessionIdleTimeoutMinutes(1, actorId);

    const stale = await prisma.userSession.create({
      data: {
        userId,
        startedAt: new Date(Date.now() - 5 * 60_000),
        lastHeartbeatAt: new Date(Date.now() - 5 * 60_000),
      },
    });

    await userSessionRepository.closeStaleSessions();

    const reloaded = await prisma.userSession.findUnique({ where: { id: stale.id } });
    assert.ok(reloaded?.closedAt, "a session idle for longer than the configured 1-minute window must be closed");
    assert.equal(reloaded?.closedAt?.getTime(), reloaded?.lastHeartbeatAt.getTime());
  });

  test("userService.getMe exposes the current sessionIdleTimeoutMinutes to the caller", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    await userService.updateSessionIdleTimeoutMinutes(33, actorId);

    const me = await userService.getMe(userId);
    assert.equal(me.sessionIdleTimeoutMinutes, 33);
  });
});
