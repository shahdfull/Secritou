import type { RequestHandler } from "express";
import { clientProfitabilityService } from "../services/clientProfitability.service.js";

export const getClientProfitability: RequestHandler = async (_req, res, next) => {
  try {
    const data = await clientProfitabilityService.getProfitability();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
