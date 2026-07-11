import type { RequestHandler } from "express";
import { healthBoardService } from "../services/healthBoard.service.js";
import { buildServiceScope } from "../utils/serviceScope.js";

export const getHealthBoard: RequestHandler = async (req, res, next) => {
  try {
    // MANAGER is always scoped to their own service; ADMIN may optionally filter by ?serviceId=.
    const scope = await buildServiceScope(req);
    const serviceId = scope.userRole === "MANAGER" ? (scope.userServiceId ?? "__none__") : (req.query.serviceId as string | undefined);
    const data = await healthBoardService.getHealthBoard(serviceId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
