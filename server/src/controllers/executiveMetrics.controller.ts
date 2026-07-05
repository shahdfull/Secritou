import type { Request, Response } from "express";
import { executiveMetricsService } from "../services/executiveMetrics.service.js";

export async function getExecutiveMetrics(_req: Request, res: Response) {
  const data = await executiveMetricsService.get();
  res.json({ data });
}
