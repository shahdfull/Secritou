import type { RequestHandler } from "express";
import { summaryService } from "../services/summary.service.js";
import { HttpError } from "../utils/httpError.js";
import { buildServiceScope } from "../utils/serviceScope.js";

export const getClientSummary: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.params.clientId as string;
    const userRole = req.user?.role!;
    const userClientId = req.user?.clientId;
    const summary = await summaryService.getClientSummary(clientId, userRole, userClientId);
    if (!summary) throw new HttpError(404, "Client not found");
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
};

export const getProjectSummary: RequestHandler = async (req, res, next) => {
  try {
    const projectId = req.params.projectId as string;
    const userRole = req.user?.role!;
    const userClientId = req.user?.clientId;
    const userId = req.user?.sub!;
    const summary = await summaryService.getProjectSummary(projectId, userRole, userClientId, userId);
    if (!summary) throw new HttpError(404, "Project not found");
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
};

export const getEnhancedDashboardSummary: RequestHandler = async (req, res, next) => {
  try {
    const scope = req.user!.role === "MANAGER" ? await buildServiceScope(req) : undefined;
    const summary = await summaryService.getEnhancedDashboardSummary(scope?.userServiceId);
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
};
