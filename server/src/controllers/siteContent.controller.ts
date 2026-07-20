import type { RequestHandler } from "express";
import { siteContentService } from "../services/siteContent.service.js";
import { HttpError } from "../utils/httpError.js";

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
      throw new HttpError(400, "key, locale and value are required", "MISSING_SITE_CONTENT_FIELDS");
    }
    const updated = await siteContentService.upsertOne(key, locale, value);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
};
