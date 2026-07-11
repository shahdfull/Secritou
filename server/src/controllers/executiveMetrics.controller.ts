import type { Request, Response } from "express";
import { executiveMetricsService } from "../services/executiveMetrics.service.js";
import { buildServiceScope } from "../utils/serviceScope.js";

export async function getExecutiveMetrics(req: Request, res: Response) {
  const scope = await buildServiceScope(req);
  const serviceId = scope.userRole === "MANAGER" ? (scope.userServiceId ?? "__none__") : (req.query.serviceId as string | undefined);
  const data = await executiveMetricsService.get(serviceId);
  res.json({ data });
}
