import type { RequestHandler } from "express";
import { projectTemplateService } from "../services/projectTemplate.service.js";

export const getTemplateForService: RequestHandler = async (req, res, next) => {
  try {
    const data = await projectTemplateService.getForService(req.params.serviceId as string);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const applyTemplateToProject: RequestHandler = async (req, res, next) => {
  try {
    const data = await projectTemplateService.applyToProject(req.params.id as string);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
};
