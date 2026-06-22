// Controller for Projects - HTTP request handlers
import type { RequestHandler } from "express";
import { projectService } from "../services/project.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { HttpError } from "../utils/httpError.js";
import { buildServiceScope } from "../utils/serviceScope.js";
import { COMPANY_ID } from "../config/constants.js";

export const getAllProjects: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.sub!;
    const userRole = req.user?.role!;
    const clientId = req.user?.clientId as string | undefined;
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await projectService.getAllProjects(userId, userRole, options, clientId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getProjectById: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.sub!;
    const userRole = req.user?.role!;
    const clientId = req.user?.clientId as string | undefined;
    const project = await projectService.getProjectById(req.params.id as string, userId, userRole, clientId);
    res.json({ data: project });
  } catch (error) {
    next(error);
  }
};

export const createProject: RequestHandler = async (req, res, next) => {
  try {
    const scope = req.user?.role === "MANAGER" ? await buildServiceScope(req) : undefined;
    const project = await projectService.createProject(req.body, scope);
    res.status(201).json({ data: project });
  } catch (error) {
    next(error);
  }
};

export const updateProject: RequestHandler = async (req, res, next) => {
  try {
    const scope = req.user?.role === "MANAGER" ? await buildServiceScope(req) : undefined;
    const project = await projectService.updateProject(req.params.id as string, req.body, scope);
    res.json({ data: project });
  } catch (error) {
    next(error);
  }
};

export const deleteProject: RequestHandler = async (req, res, next) => {
  try {
    await projectService.deleteProject(req.params.id as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const archiveProject: RequestHandler = async (req, res, next) => {
  try {
    const project = await projectService.archiveProject(req.params.id as string);
    res.json({ data: project });
  } catch (error) {
    next(error);
  }
};

export const getMyProjects: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user?.clientId!;
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await projectService.getAllProjects(
      "",
      req.user?.sub!,
      "CLIENT",
      options,
      clientId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getBrief: RequestHandler = async (req, res, next) => {
  try {
    const role = req.user?.role!;
    const clientId = req.user?.clientId as string | undefined;
    const result = await projectService.getBrief(req.params.id as string, role, clientId);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const submitBrief: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) return next(new Error("Client access required"));
    const uploadedById = req.user?.sub!;
    const updated = await projectService.submitBrief(
      req.params.id as string,
      clientId,
      uploadedById,
      req.body as Record<string, unknown>
    );
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const clientApproveProject: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) return next(new HttpError(403, "Client access required"));
    const userId = req.user?.sub!;
    const result = await projectService.clientApprove(req.params.id as string, clientId, userId);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getTimelineStatus: RequestHandler = async (req, res, next) => {
  try {
    const role = req.user?.role!;
    const clientId = req.user?.clientId as string | undefined;
    const steps = await projectService.getTimelineStatus(
      req.params.id as string,
      role,
      clientId
    );
    res.json({ data: steps });
  } catch (error) {
    next(error);
  }
};
