import type { RequestHandler } from "express";
import { timeEntryService } from "../services/timeEntry.service.js";
import { HttpError } from "../utils/httpError.js";

export const createTimeEntry: RequestHandler = async (req, res, next) => {
  try {
    const projectId = req.params.id as string;
    const userId = req.user!.sub;
    const userRole = req.user!.role;
    const entry = await timeEntryService.create(projectId, userId, userRole, req.body);
    res.status(201).json({ data: entry });
  } catch (err) {
    next(err);
  }
};

export const listTimeEntries: RequestHandler = async (req, res, next) => {
  try {
    const projectId = req.params.id as string;
    const page = Number(req.query.page) || 1;
    const pageSize = Math.min(Number(req.query.pageSize) || 20, 100);
    const result = await timeEntryService.list(projectId, page, pageSize, req.user!.sub, req.user!.role);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getTimeSummary: RequestHandler = async (req, res, next) => {
  try {
    const projectId = req.params.id as string;
    const summary = await timeEntryService.summary(projectId);
    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
};

export const getGlobalTimeSummary: RequestHandler = async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(req.query.from as string) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    if (isNaN(from.getTime()) || isNaN(to.getTime())) throw new HttpError(400, "Invalid date parameters");
    const summary = await timeEntryService.globalSummary(from, to);
    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
};
