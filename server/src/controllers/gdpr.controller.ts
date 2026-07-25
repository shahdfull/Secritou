import type { RequestHandler } from "express";
import { gdprService } from "../services/gdpr.service.js";
import { HttpError } from "../utils/httpError.js";

export const exportClient: RequestHandler = async (req, res, next) => {
  try {
    const data = await gdprService.exportClient(req.params.id as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

export const eraseClient: RequestHandler = async (req, res, next) => {
  try {
    const actor = { id: req.user?.sub, role: req.user?.role, ip: req.ip };
    const result = await gdprService.eraseClient(req.params.id as string, actor);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const exportUser: RequestHandler = async (req, res, next) => {
  try {
    const data = await gdprService.exportUser(req.params.id as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

export const eraseUser: RequestHandler = async (req, res, next) => {
  try {
    const actor = { id: req.user?.sub, role: req.user?.role, ip: req.ip };
    const result = await gdprService.eraseUser(req.params.id as string, actor);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const exportLead: RequestHandler = async (req, res, next) => {
  try {
    const data = await gdprService.exportLead(req.params.id as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

export const eraseLead: RequestHandler = async (req, res, next) => {
  try {
    const actor = { id: req.user?.sub, role: req.user?.role, ip: req.ip };
    const result = await gdprService.eraseLead(req.params.id as string, actor);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const exportContactRequest: RequestHandler = async (req, res, next) => {
  try {
    const data = await gdprService.exportContactRequest(req.params.id as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

export const eraseContactRequest: RequestHandler = async (req, res, next) => {
  try {
    const actor = { id: req.user?.sub, role: req.user?.role, ip: req.ip };
    const result = await gdprService.eraseContactRequest(req.params.id as string, actor);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

// Self-service (SEC-224): identity is always req.user.sub — never trusts a URL param, so a
// CLIENT/FREELANCER can only ever reach their own record no matter what they send.
export const exportMe: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user?.sub) throw new HttpError(401, "Not authenticated");
    const data = await gdprService.exportUser(req.user.sub);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

export const eraseMe: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user?.sub) throw new HttpError(401, "Not authenticated");
    const actor = { id: req.user.sub, role: req.user.role, ip: req.ip };
    const result = await gdprService.eraseUser(req.user.sub, actor);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};
