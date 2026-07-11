import { prisma, prismaRead } from "../config/prisma.js";

export interface CreateTimeEntryDTO {
  projectId: string;
  userId: string;
  taskId?: string;
  description?: string;
  minutes: number;
  date: Date;
}

export const timeEntryRepository = {
  async create(data: CreateTimeEntryDTO) {
    return prisma.timeEntry.create({
      data,
      include: {
        user: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    });
  },

  async findByProject(projectId: string, page: number, pageSize: number, ownUserId?: string) {
    const skip = (page - 1) * pageSize;
    const where = { projectId, ...(ownUserId ? { userId: ownUserId } : {}) };
    const [data, total] = await Promise.all([
      prismaRead.timeEntry.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
          task: { select: { id: true, title: true } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
      }),
      prismaRead.timeEntry.count({ where }),
    ]);
    return { data, total, page, pageSize };
  },

  // A freelancer's own hours + amount due on a project (their own hourlyRate only —
  // never the client-facing budget/TJM, which is a margin figure kept ADMIN/MANAGER-only).
  async getMySummaryByProject(projectId: string, userId: string) {
    const [entries, profile] = await Promise.all([
      prismaRead.timeEntry.findMany({ where: { projectId, userId }, select: { minutes: true } }),
      prismaRead.freelancerProfile.findUnique({ where: { userId }, select: { hourlyRate: true } }),
    ]);

    const totalMinutes = entries.reduce((s, e) => s + e.minutes, 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    const hourlyRate = profile?.hourlyRate ? Number(profile.hourlyRate) : null;
    const amountDue = hourlyRate !== null ? Math.round((totalMinutes / 60) * hourlyRate * 100) / 100 : null;

    return { totalMinutes, totalHours, hourlyRate, amountDue };
  },

  async getSummaryByProject(projectId: string) {
    const entries = await prismaRead.timeEntry.findMany({
      where: { projectId },
      select: { minutes: true, userId: true, taskId: true, user: { select: { name: true } }, task: { select: { title: true } } },
    });

    const totalMinutes = entries.reduce((s, e) => s + e.minutes, 0);

    const byUserMap = new Map<string, { userId: string; userName: string; totalMinutes: number }>();
    const byTaskMap = new Map<string, { taskId: string; taskTitle: string; totalMinutes: number }>();

    for (const e of entries) {
      const u = byUserMap.get(e.userId);
      if (u) u.totalMinutes += e.minutes;
      else byUserMap.set(e.userId, { userId: e.userId, userName: e.user.name, totalMinutes: e.minutes });

      if (e.taskId && e.task) {
        const t = byTaskMap.get(e.taskId);
        if (t) t.totalMinutes += e.minutes;
        else byTaskMap.set(e.taskId, { taskId: e.taskId, taskTitle: e.task.title, totalMinutes: e.minutes });
      }
    }

    return {
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      byUser: Array.from(byUserMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes),
      byTask: Array.from(byTaskMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes),
    };
  },

  async getWorkloadByAssignee(from: Date, to: Date, serviceId?: string) {
    const [entries, activeTasks] = await Promise.all([
      prismaRead.timeEntry.findMany({
        where: {
          date: { gte: from, lte: to },
          ...(serviceId ? { project: { serviceId } } : {}),
        },
        select: { minutes: true, userId: true, user: { select: { name: true } } },
      }),
      prismaRead.task.findMany({
        where: {
          status: { not: "DONE" },
          assigneeId: { not: null },
          ...(serviceId ? { project: { serviceId } } : {}),
        },
        select: { assigneeId: true, assignee: { select: { name: true } } },
      }),
    ]);

    const byUser = new Map<string, { userId: string; userName: string; totalMinutes: number; activeTaskCount: number }>();

    for (const e of entries) {
      const existing = byUser.get(e.userId);
      if (existing) existing.totalMinutes += e.minutes;
      else byUser.set(e.userId, { userId: e.userId, userName: e.user.name, totalMinutes: e.minutes, activeTaskCount: 0 });
    }

    for (const t of activeTasks) {
      if (!t.assigneeId) continue;
      const existing = byUser.get(t.assigneeId);
      if (existing) existing.activeTaskCount += 1;
      else byUser.set(t.assigneeId, { userId: t.assigneeId, userName: t.assignee!.name, totalMinutes: 0, activeTaskCount: 1 });
    }

    return Array.from(byUser.values())
      .map((u) => ({ ...u, totalHours: Math.round((u.totalMinutes / 60) * 10) / 10 }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  },

  async getTimeSummaryByPeriod(from: Date, to: Date, serviceId?: string) {
    const entries = await prismaRead.timeEntry.findMany({
      where: {
        date: { gte: from, lte: to },
        ...(serviceId ? { project: { serviceId } } : {}),
      },
      select: { minutes: true, projectId: true, project: { select: { name: true } } },
    });

    const byProject = new Map<string, { projectId: string; projectName: string; totalMinutes: number }>();
    for (const e of entries) {
      const p = byProject.get(e.projectId);
      if (p) p.totalMinutes += e.minutes;
      else byProject.set(e.projectId, { projectId: e.projectId, projectName: e.project.name, totalMinutes: e.minutes });
    }

    const totalMinutes = entries.reduce((s, e) => s + e.minutes, 0);
    return {
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      byProject: Array.from(byProject.values()).sort((a, b) => b.totalMinutes - a.totalMinutes),
    };
  },
};
