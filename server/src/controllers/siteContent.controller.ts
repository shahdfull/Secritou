import type { RequestHandler } from "express";
import { siteContentService } from "../services/siteContent.service.js";

/** GET /api/v1/site-content?locale=fr|en — public */
export const getPublicSiteContent: RequestHandler = async (req, res, next) => {
  try {
    const data = await siteContentService.getFlat(req.query.locale);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/admin/site-content?locale=fr|en — ADMIN */
export const getGroupedSiteContent: RequestHandler = async (req, res, next) => {
  try {
    const data = await siteContentService.getGrouped(req.query.locale);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/v1/admin/site-content — ADMIN, body: { key, locale, value } */
export const upsertSiteContent: RequestHandler = async (req, res, next) => {
  try {
    const { key, locale, value } = req.body as { key: string; locale: string; value: string };
    if (!key || !locale || value === undefined) {
      res.status(400).json({ error: "key, locale and value are required" });
      return;
    }
    const updated = await siteContentService.upsertOne(key, locale, value);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
};
