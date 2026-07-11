import type { RequestHandler } from "express";
import { clientProfitabilityService } from "../services/clientProfitability.service.js";
import { buildServiceScope } from "../utils/serviceScope.js";

export const getClientProfitability: RequestHandler = async (req, res, next) => {
  try {
    const scope = await buildServiceScope(req);
    const serviceId = scope.userRole === "MANAGER" ? (scope.userServiceId ?? "__none__") : (req.query.serviceId as string | undefined);
    const data = await clientProfitabilityService.getProfitability(serviceId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
