import { prisma } from "../config/prisma.js";

export async function getProgressByProjectIds(projectIds: string[]): Promise<Map<string, number>> {
  if (projectIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.$queryRaw<Array<{ projectId: string; progress: number }>>`
    SELECT t."projectId",
      COALESCE(
        ROUND(100.0 * COUNT(*) FILTER (WHERE t.status = 'DONE') / NULLIF(COUNT(*), 0)),
        0
      )::int AS progress
    FROM "Task" t
    WHERE t."projectId" = ANY(${projectIds}::text[])
    GROUP BY t."projectId"
  `;

  return new Map(rows.map((row) => [row.projectId, Number(row.progress)]));
}

export async function getProgressForProject(projectId: string): Promise<number> {
  const map = await getProgressByProjectIds([projectId]);
  return map.get(projectId) ?? 0;
}
