import type { NextFunction, Request, Response } from "express";
import {
  httpErrorsTotal,
  httpRequestDuration,
  httpRequestsTotal,
} from "./metrics.js";

const SKIP_PATHS = new Set(["/metrics", "/api/v1/metrics/web-vitals"]);

function normalizeRoute(req: Request): string {
  if (req.route?.path) {
    const base = req.baseUrl ?? "";
    return `${base}${req.route.path}`;
  }
  const path = req.path ?? req.url.split("?")[0] ?? "unknown";
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
    .replace(/\/\d+/g, "/:id");
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  if (SKIP_PATHS.has(req.path)) {
    next();
    return;
  }

  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSec = durationNs / 1e9;
    const route = normalizeRoute(req);
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    httpRequestDuration.observe(labels, durationSec);
    httpRequestsTotal.inc(labels);

    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? "server" : "client";
      httpErrorsTotal.inc({ ...labels, error_type: errorType });
    }
  });

  next();
}
