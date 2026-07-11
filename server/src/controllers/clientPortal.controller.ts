import type { RequestHandler } from "express";
import { clientPortalService } from "../services/clientPortal.service.js";
import { gscConnectionService } from "../services/gscConnection.service.js";
import { metricSnapshotRepository } from "../repositories/metricSnapshot.repository.js";
import { HttpError } from "../utils/httpError.js";
import type { MetricSource } from "@prisma/client";

export const getClientPortalSummary: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user!.clientId;
    if (!clientId) throw new HttpError(403, "No client associated with this account");
    const data = await clientPortalService.getSummary(clientId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

// Read-only SEO reporting for the logged-in client — never exposes connect/disconnect
// actions (that stays ADMIN/MANAGER-only via /integrations/gsc), just their own data.
export const getClientPortalSeoStatus: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user!.clientId;
    if (!clientId) throw new HttpError(403, "No client associated with this account");
    const status = await gscConnectionService.getStatus(clientId);
    res.json({ data: status });
  } catch (err) {
    next(err);
  }
};

export const getClientPortalSeoMetrics: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user!.clientId;
    if (!clientId) throw new HttpError(403, "No client associated with this account");
    const { source, metric, from, to } = req.query as Record<string, string | undefined>;
    const rows = await metricSnapshotRepository.getByClient(clientId, {
      source: source as MetricSource | undefined,
      metric,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};
