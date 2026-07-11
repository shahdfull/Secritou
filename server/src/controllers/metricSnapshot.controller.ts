import type { Request, Response } from "express";
import { metricSnapshotRepository } from "../repositories/metricSnapshot.repository.js";
import type { MetricSource } from "@prisma/client";

export const getClientMetrics = async (req: Request, res: Response) => {
  const clientId = req.params.clientId as string;
  const { source, metric, from, to } = req.query as Record<string, string | undefined>;
  const rows = await metricSnapshotRepository.getByClient(clientId, {
    source: source as MetricSource | undefined,
    metric,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });
  res.json({ data: rows });
};
