import type { RequestHandler } from "express";
import { serviceService } from "../services/service.service.js";

export const listServices: RequestHandler = async (_req, res, next) => {
  try {
    const data = await serviceService.listAll();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
