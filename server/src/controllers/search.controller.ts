import type { RequestHandler } from "express";
import { searchService } from "../services/search.service.js";

export const globalSearch: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId ?? undefined;
    const q = (req.query.q as string) || "";
    const results = await searchService.search(companyId, q);
    res.json({ data: results });
  } catch (error) {
    next(error);
  }
};
