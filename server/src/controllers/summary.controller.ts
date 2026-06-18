import type { RequestHandler } from "express";
import { summaryService } from "../services/summary.service.js";
import { HttpError } from "../utils/httpError.js";

export const getClientSummary: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    const clientId = req.params.clientId;
    if (!companyId) throw new HttpError(400, "Company required");

    const summary = await summaryService.getClientSummary(companyId, clientId);
    if (!summary) throw new HttpError(404, "Client not found");
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
};

export const getProjectSummary: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    const projectId = req.params.projectId;
    if (!companyId) throw new HttpError(400, "Company required");

    const summary = await summaryService.getProjectSummary(companyId, projectId);
    if (!summary) throw new HttpError(404, "Project not found");
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
};

export const getEnhancedDashboardSummary: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) throw new HttpError(400, "Company required");

    const summary = await summaryService.getEnhancedDashboardSummary(companyId);
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
};
