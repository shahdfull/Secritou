// SEC-070: cross-entity semantic search over Lead.notes/Project.description/Task.description via
// pgvector cosine distance. Each entity branch below mirrors the EXACT scoping rule its own
// repository already applies for a MANAGER — never a new rule invented for this cross-entity case:
//   - Lead: leadRepository.buildWhere's leadServiceFilter (OR serviceId / assignedManagerId)
//   - Project: projectRepository/ServiceScope convention (plain serviceId)
//   - Task: task.repository.ts buildWhere's projectFilter (serviceId via the parent Project)
// The scope filter is applied in the WHERE clause of each branch BEFORE the outer ORDER BY
// distance — never a post-hoc filter on already-fetched rows. An ADMIN (no service) is unscoped,
// same as every other tool in aiTools.ts.
import { prisma } from "../config/prisma.js";
import type { Role } from "@prisma/client";

export type SearchEmbeddingScope = { userRole: Role; userServiceId?: string | null; userId?: string };

export type SemanticSearchResult = {
  entityType: "lead" | "project" | "task";
  entityId: string;
  sourceText: string;
  distance: number;
};

export const searchEmbeddingRepository = {
  async searchSimilar(
    queryEmbedding: number[],
    scope: SearchEmbeddingScope,
    limit: number
  ): Promise<SemanticSearchResult[]> {
    const vectorLiteral = `[${queryEmbedding.join(",")}]`;
    const isManager = scope.userRole === "MANAGER";
    const managerServiceId = scope.userServiceId ?? "__none__";
    const managerUserId = scope.userId ?? "__none__";

    const rows = await prisma.$queryRaw<
      { entityType: string; entityId: string; sourceText: string; distance: number }[]
    >`
      (
        SELECT 'lead' AS "entityType", se."leadId" AS "entityId", se."sourceText",
               se.embedding <-> ${vectorLiteral}::vector AS distance
        FROM "SearchEmbedding" se
        JOIN "Lead" l ON l.id = se."leadId"
        WHERE se."leadId" IS NOT NULL
          AND l."archivedAt" IS NULL
          AND (
            ${!isManager} OR l."serviceId" = ${managerServiceId} OR l."assignedManagerId" = ${managerUserId}
          )
      )
      UNION ALL
      (
        SELECT 'project' AS "entityType", se."projectId" AS "entityId", se."sourceText",
               se.embedding <-> ${vectorLiteral}::vector AS distance
        FROM "SearchEmbedding" se
        JOIN "Project" p ON p.id = se."projectId"
        WHERE se."projectId" IS NOT NULL
          AND p."archivedAt" IS NULL AND p."deletedAt" IS NULL
          AND (${!isManager} OR p."serviceId" = ${managerServiceId})
      )
      UNION ALL
      (
        SELECT 'task' AS "entityType", se."taskId" AS "entityId", se."sourceText",
               se.embedding <-> ${vectorLiteral}::vector AS distance
        FROM "SearchEmbedding" se
        JOIN "Task" t ON t.id = se."taskId"
        JOIN "Project" tp ON tp.id = t."projectId"
        WHERE se."taskId" IS NOT NULL
          AND tp."archivedAt" IS NULL AND tp."deletedAt" IS NULL
          AND (${!isManager} OR tp."serviceId" = ${managerServiceId})
      )
      ORDER BY distance ASC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      entityType: r.entityType as SemanticSearchResult["entityType"],
      entityId: r.entityId,
      sourceText: r.sourceText,
      distance: r.distance,
    }));
  },
};
