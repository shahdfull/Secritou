import { prisma, prismaRead } from "../config/prisma.js";

// A heartbeat within this window is treated as "the same session" (extends it)
// rather than starting a new one. Must stay in sync with the client's ping
// interval (see useSessionHeartbeat.ts) plus margin for one missed tick.
export const SESSION_IDLE_TIMEOUT_MINUTES = 3;

export const userSessionRepository = {
  // Extends the caller's most recent still-open session if the last heartbeat was
  // within the idle window, otherwise starts a new session (previous tab closed /
  // laptop slept long enough to be treated as a gap, not continuous usage).
  async recordHeartbeat(userId: string): Promise<void> {
    const cutoff = new Date(Date.now() - SESSION_IDLE_TIMEOUT_MINUTES * 60_000);
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
    const cutoff = new Date(Date.now() - SESSION_IDLE_TIMEOUT_MINUTES * 60_000);
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
