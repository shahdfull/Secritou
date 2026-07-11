import { prisma, prismaRead } from "../config/prisma.js";
import type { MetricSource } from "@prisma/client";

export interface MetricSnapshotInput {
  clientId: string;
  projectId?: string | null;
  source: MetricSource;
  metric: string;
  value: number;
  // Empty string ("") means aggregated across the whole property for this period —
  // dimension is non-nullable in the schema so the compound unique below stays usable.
  dimension?: string;
  periodStart: Date;
  periodEnd: Date;
}

export const metricSnapshotRepository = {
  // Upsert-per-row on the natural key so re-running a job for the same period is
  // idempotent (overwrites the value instead of accumulating duplicate rows).
  async upsertMany(rows: MetricSnapshotInput[]) {
    await Promise.all(
      rows.map((row) => {
        const dimension = row.dimension ?? "";
        return prisma.metricSnapshot.upsert({
          where: {
            clientId_source_metric_dimension_periodStart_periodEnd: {
              clientId: row.clientId,
              source: row.source,
              metric: row.metric,
              dimension,
              periodStart: row.periodStart,
              periodEnd: row.periodEnd,
            },
          },
          create: { ...row, dimension },
          update: { value: row.value, projectId: row.projectId },
        });
      })
    );
  },

  async getByClient(clientId: string, options: { source?: MetricSource; metric?: string; from?: Date; to?: Date }) {
    return prismaRead.metricSnapshot.findMany({
      where: {
        clientId,
        source: options.source,
        metric: options.metric,
        ...(options.from || options.to
          ? { periodStart: { ...(options.from && { gte: options.from }), ...(options.to && { lte: options.to }) } }
          : {}),
      },
      orderBy: { periodStart: "asc" },
    });
  },
};
