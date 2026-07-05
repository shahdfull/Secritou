import type { RequestHandler } from "express";
import { healthBoardService } from "../services/healthBoard.service.js";

export const getHealthBoard: RequestHandler = async (_req, res, next) => {
  try {
    const data = await healthBoardService.getHealthBoard();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
