import { prisma, prismaRead } from "../config/prisma.js";
import { appSettingRepository } from "./appSetting.repository.js";

// RG-020 (décision du porteur du projet, session du 2026-07-28, voir REFERENTIEL.md §7) :
// valeur par défaut si l'entrée AppSetting.SESSION_IDLE_TIMEOUT_MINUTES_KEY est absente.
// Le seuil effectif est configurable en base par un ADMIN (server/src/services/appSetting.service.ts).
export const DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES = 20;
export const SESSION_IDLE_TIMEOUT_MINUTES_KEY = "sessionIdleTimeoutMinutes";

export async function getSessionIdleTimeoutMinutes(): Promise<number> {
  const raw = await appSettingRepository.get(SESSION_IDLE_TIMEOUT_MINUTES_KEY);
  const parsed = raw !== null ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES;
}

export const userSessionRepository = {
  // Extends the caller's most recent still-open session if the last heartbeat was
  // within the idle window, otherwise starts a new session (previous tab closed /
  // laptop slept long enough to be treated as a gap, not continuous usage).
  async recordHeartbeat(userId: string): Promise<void> {
    const timeoutMinutes = await getSessionIdleTimeoutMinutes();
    const cutoff = new Date(Date.now() - timeoutMinutes * 60_000);
    const now = new Date();

    const openSession = await prisma.userSession.findFirst({
      where: { userId, closedAt: null, lastHeartbeatAt: { gte: cutoff } },
      orderBy: { lastHeartbeatAt: "desc" },
      select: { id: true },
    });

    if (openSession) {
      await prisma.userSession.update({
        where: { id: openSession.id },
        data: { lastHeartbeatAt: now },
      });
      return;
    }

    await prisma.userSession.create({
      data: { userId, startedAt: now, lastHeartbeatAt: now },
    });
  },

  // Closes sessions whose last heartbeat is older than the idle window — the tab was
  // closed/backgrounded without a final ping, so lastHeartbeatAt is the effective end time.
  // updateMany can't set a column to another column's value, hence the raw query.
  async closeStaleSessions(): Promise<number> {
    const timeoutMinutes = await getSessionIdleTimeoutMinutes();
    const cutoff = new Date(Date.now() - timeoutMinutes * 60_000);
    const count = await prisma.$executeRaw`
      UPDATE "UserSession"
      SET "closedAt" = "lastHeartbeatAt"
      WHERE "closedAt" IS NULL AND "lastHeartbeatAt" < ${cutoff}
    `;
    return count;
  },

  // Total connected seconds per user within [since, now], one row per (userId, day),
  // for the caller to bucket into day/week/month averages.
  async findDailyConnectedSeconds(
    userIds: string[],
    since: Date
  ): Promise<Array<{ userId: string; day: Date; seconds: number }>> {
    if (userIds.length === 0) return [];
    const rows = await prismaRead.$queryRaw<Array<{ userId: string; day: Date; seconds: bigint }>>`
      SELECT
        "userId",
        date_trunc('day', "startedAt") AS day,
        SUM(EXTRACT(EPOCH FROM (COALESCE("closedAt", "lastHeartbeatAt") - "startedAt")))::bigint AS seconds
      FROM "UserSession"
      WHERE "userId" = ANY(${userIds})
        AND "startedAt" >= ${since}
      GROUP BY "userId", date_trunc('day', "startedAt")
    `;
    return rows.map((r) => ({ userId: r.userId, day: r.day, seconds: Number(r.seconds) }));
  },
};
