import type { RequestHandler } from "express";
import { analyticsEventService } from "../services/analyticsEvent.service.js";
import { MAX_PROPERTIES_BYTES } from "../validators/analyticsEvent.validator.js";
import { HttpError } from "../utils/httpError.js";

export const recordEvent: RequestHandler = async (req, res, next) => {
  try {
    if (req.body.properties && Buffer.byteLength(JSON.stringify(req.body.properties), "utf8") > MAX_PROPERTIES_BYTES) {
      throw new HttpError(413, "properties payload too large");
    }

    await analyticsEventService.recordEvent(req.body);
    // sendBeacon/fetch keepalive callers don't read the response body; 204 keeps it minimal.
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const getEventSummary: RequestHandler = async (req, res, next) => {
  try {
    const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
    const to = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;

    const [summary, topPages, funnels] = await Promise.all([
      analyticsEventService.getEventSummary(from, to),
      analyticsEventService.getTopPages(from, to),
      analyticsEventService.getFunnels(from, to),
    ]);

    res.json({ data: { ...summary, topPages, funnels } });
  } catch (error) {
    next(error);
  }
};
