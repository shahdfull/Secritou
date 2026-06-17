// Controller for Projects - HTTP request handlers
import type { RequestHandler } from "express";
import { projectService } from "../services/project.service.js";
import { parseListQuery } from "../utils/listQuery.js";

export const getAllProjects: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const userId = req.user?.sub!;
    const userRole = req.user?.role!;
    const clientId = req.user?.clientId as string | undefined;
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await projectService.getAllProjects(companyId, userId, userRole, options, clientId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getProjectById: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const userId = req.user?.sub!;
    const userRole = req.user?.role!;
    const clientId = req.user?.clientId as string | undefined;
    const project = await projectService.getProjectById(req.params.id as string, companyId, userId, userRole, clientId);
    res.json({ data: project });
  } catch (error) {
    next(error);
  }
};

export const createProject: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const project = await projectService.createProject(req.body, companyId);
    res.status(201).json({ data: project });
  } catch (error) {
    next(error);
  }
};

export const updateProject: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const project = await projectService.updateProject(req.params.id as string, req.body, companyId);
    res.json({ data: project });
  } catch (error) {
    next(error);
  }
};

export const deleteProject: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    await projectService.deleteProject(req.params.id as string, companyId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
