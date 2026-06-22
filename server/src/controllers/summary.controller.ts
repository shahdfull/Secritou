import type { RequestHandler } from "express";
import { summaryService } from "../services/summary.service.js";

export const getClientSummary: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.params.clientId as string;
    const summary = await summaryService.getClientSummary(clientId);
    if (!summary) throw new Error("Client not found");
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
};

export const getProjectSummary: RequestHandler = async (req, res, next) => {
  try {
    const projectId = req.params.projectId as string;
    const summary = await summaryService.getProjectSummary(projectId);
    if (!summary) throw new Error("Project not found");
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
};

export const getEnhancedDashboardSummary: RequestHandler = async (req, res, next) => {
  try {
    const summary = await summaryService.getEnhancedDashboardSummary();
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
};
