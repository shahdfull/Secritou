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

export const archiveProject: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const project = await projectService.archiveProject(req.params.id as string, companyId);
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
    const companyId = req.user?.companyId ?? "";
    const clientId = req.user?.clientId as string | undefined;
    const result = await projectService.getBrief(req.params.id as string, companyId, role, clientId);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const submitBrief: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) return next(new Error("Client access required"));
    const companyId = req.user?.companyId ?? "";
    const uploadedById = req.user?.sub!;
    const updated = await projectService.submitBrief(
      req.params.id as string,
      companyId,
      clientId,
      uploadedById,
      req.body as Record<string, unknown>
    );
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const getTimelineStatus: RequestHandler = async (req, res, next) => {
  try {
    const role = req.user?.role!;
    const companyId = req.user?.companyId ?? "";
    const clientId = req.user?.clientId as string | undefined;
    const steps = await projectService.getTimelineStatus(
      req.params.id as string,
      companyId,
      role,
      clientId
    );
    res.json({ data: steps });
  } catch (error) {
    next(error);
  }
};
