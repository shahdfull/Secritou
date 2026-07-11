import type { RequestHandler } from "express";
import { revenueForecastService } from "../services/revenueForecast.service.js";
import { buildServiceScope } from "../utils/serviceScope.js";

export const getRevenueForecast: RequestHandler = async (req, res, next) => {
  try {
    const scope = await buildServiceScope(req);
    const serviceId = scope.userRole === "MANAGER" ? (scope.userServiceId ?? "__none__") : (req.query.serviceId as string | undefined);
    const data = await revenueForecastService.getForecast(serviceId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
