import { prismaRead } from "../config/prisma.js";

export type HealthScore = "green" | "orange" | "red";

export interface ProjectHealthItem {
  id: string;
  name: string;
  clientName: string;
  status: string;
  progress: number;
  deadline: Date | null;
  daysUntilDeadline: number | null;
  isOverdue: boolean;
  budget: string | null;
  openTasksCount: number;
  blockedTasksCount: number;
  lastActivityAt: Date | null;
  daysSinceLastActivity: number | null;
  isStale: boolean;
  briefCompleted: boolean;
  contractSigned: boolean;
  healthScore: HealthScore;
}

function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export const healthBoardRepository = {
  async getActiveProjectsHealth(): Promise<ProjectHealthItem[]> {
    const now = new Date();

    const projects = await prismaRead.project.findMany({
      where: { archivedAt: null, status: { notIn: ["COMPLETED"] } },
      select: {
        id: true,
        name: true,
        status: true,
        deadline: true,
        budget: true,
        briefCompleted: true,
        client: { select: { name: true } },
        tasks: {
          select: { id: true, status: true, updatedAt: true },
        },
        documents: {
          where: { type: "CONTRACT" },
          select: { signedAt: true },
          take: 1,
        },
      },
    });

    const items: ProjectHealthItem[] = projects.map((p) => {
      const totalTasks = p.tasks.length;
      const openTasks = p.tasks.filter((t) => t.status !== "DONE");
      const openTasksCount = openTasks.length;
      const progress = totalTasks > 0 ? Math.round(((totalTasks - openTasksCount) / totalTasks) * 100) : 0;

      // Blocked = tasks in REVIEW for > 3 days
      const blockedTasksCount = p.tasks.filter((t) => {
        if (t.status !== "REVIEW") return false;
        return diffDays(t.updatedAt, now) > 3;
      }).length;

      const lastActivityAt =
        p.tasks.length > 0
          ? p.tasks.reduce<Date | null>((latest, t) => {
              if (!latest || t.updatedAt > latest) return t.updatedAt;
              return latest;
            }, null)
          : null;

      const daysSinceLastActivity = lastActivityAt ? diffDays(lastActivityAt, now) : null;
      const isStale = daysSinceLastActivity !== null ? daysSinceLastActivity > 7 : false;

      const deadline = p.deadline ?? null;
      const daysUntilDeadline = deadline ? diffDays(now, deadline) : null;
      const isOverdue = deadline !== null && deadline < now && p.status !== "COMPLETED";

      const contractSigned = p.documents.length > 0 && p.documents[0].signedAt !== null;

      let healthScore: HealthScore = "green";
      if (isOverdue || isStale || blockedTasksCount > 2) {
        healthScore = "red";
      } else if (
        (daysUntilDeadline !== null && daysUntilDeadline <= 7) ||
        blockedTasksCount > 0 ||
        (daysSinceLastActivity !== null && daysSinceLastActivity > 4)
      ) {
        healthScore = "orange";
      }

      return {
        id: p.id,
        name: p.name,
        clientName: p.client?.name ?? "—",
        status: p.status,
        progress,
        deadline,
        daysUntilDeadline,
        isOverdue,
        budget: p.budget ?? null,
        openTasksCount,
        blockedTasksCount,
        lastActivityAt,
        daysSinceLastActivity,
        isStale,
        briefCompleted: p.briefCompleted,
        contractSigned,
        healthScore,
      };
    });

    // Sort: red first, then orange, then green; within same color sort by daysUntilDeadline ASC (nulls last)
    const scoreOrder: Record<HealthScore, number> = { red: 0, orange: 1, green: 2 };
    items.sort((a, b) => {
      const scoreDiff = scoreOrder[a.healthScore] - scoreOrder[b.healthScore];
      if (scoreDiff !== 0) return scoreDiff;
      if (a.daysUntilDeadline === null && b.daysUntilDeadline === null) return 0;
      if (a.daysUntilDeadline === null) return 1;
      if (b.daysUntilDeadline === null) return -1;
      return a.daysUntilDeadline - b.daysUntilDeadline;
    });

    return items;
  },
};
