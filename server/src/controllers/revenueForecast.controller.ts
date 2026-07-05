import type { RequestHandler } from "express";
import { revenueForecastService } from "../services/revenueForecast.service.js";

export const getRevenueForecast: RequestHandler = async (_req, res, next) => {
  try {
    const data = await revenueForecastService.getForecast();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
