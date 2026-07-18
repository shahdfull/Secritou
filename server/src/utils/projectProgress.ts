import { prismaRead } from "../config/prisma.js";

export type ProjectProgressData = {
  progress: number;
  taskDone: number;
  taskTotal: number;
};

export async function getProgressByProjectIds(projectIds: string[]): Promise<Map<string, ProjectProgressData>> {
  if (projectIds.length === 0) {
    return new Map();
  }

  const rows = await prismaRead.$queryRaw<Array<{ projectId: string; progress: number; taskDone: bigint; taskTotal: bigint }>>`
    SELECT t."projectId",
      COALESCE(
        ROUND(100.0 * COUNT(*) FILTER (WHERE t.status = 'DONE') / NULLIF(COUNT(*), 0)),
        0
      )::int AS progress,
      COUNT(*) FILTER (WHERE t.status = 'DONE') AS "taskDone",
      COUNT(*) AS "taskTotal"
    FROM "Task" t
    WHERE t."projectId" = ANY(${projectIds}::text[])
    GROUP BY t."projectId"
  `;

  return new Map(rows.map((row) => [
    row.projectId,
    {
      progress: Number(row.progress),
      taskDone: Number(row.taskDone),
      taskTotal: Number(row.taskTotal),
    },
  ]));
}

export async function getProgressForProject(projectId: string): Promise<ProjectProgressData> {
  const map = await getProgressByProjectIds([projectId]);
  return map.get(projectId) ?? { progress: 0, taskDone: 0, taskTotal: 0 };
}
