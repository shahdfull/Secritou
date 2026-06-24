// Lead Controller - HTTP request handlers
import type { RequestHandler } from "express";
import { leadService } from "../services/lead.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { buildServiceScope as buildScope } from "../utils/serviceScope.js";
import { COMPANY_ID } from "../config/constants.js";

export const getLeads: RequestHandler = async (req, res, next) => {
  try {
    const options = parseListQuery(req.query as Record<string, unknown>);
    const includeArchived = req.query.includeArchived === "true";
    const result = await leadService.getLeads({ ...options, includeArchived }, await buildScope(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getLead: RequestHandler = async (req, res, next) => {
  try {
    const includeArchived = req.query.includeArchived === "true";
    const lead = await leadService.getLead(req.params.id as string, await buildScope(req), includeArchived);
    res.json({ data: lead });
  } catch (error) {
    next(error);
  }
};

export const createLead: RequestHandler = async (req, res, next) => {
  try {
    const lead = await leadService.createLead(req.body);
    res.status(201).json({ data: lead });
  } catch (error) {
    next(error);
  }
};

export const updateLead: RequestHandler = async (req, res, next) => {
  try {
    const lead = await leadService.updateLead(req.params.id as string, req.body, await buildScope(req));
    res.json({ data: lead });
  } catch (error) {
    next(error);
  }
};

export const deleteLead: RequestHandler = async (req, res, next) => {
  try {
    await leadService.deleteLead(req.params.id as string, await buildScope(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const convertLeadToClient: RequestHandler = async (req, res, next) => {
  try {
    const client = await leadService.convertLeadToClient(req.params.id as string, await buildScope(req));
    res.status(201).json({ data: client });
  } catch (error) {
    next(error);
  }
};

export const reopenLead: RequestHandler = async (req, res, next) => {
  try {
    const lead = await leadService.reopenLead(req.params.id as string, await buildScope(req));
    res.json({ data: lead });
  } catch (error) {
    next(error);
  }
};
