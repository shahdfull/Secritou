// Controller for Tasks - HTTP request handlers
import type { RequestHandler } from "express";
import { taskService } from "../services/task.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { buildServiceScope } from "../utils/serviceScope.js";
import { COMPANY_ID } from "../config/constants.js";

export const getAllTasks: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.sub!;
    const userRole = req.user?.role!;
    const projectId = req.query.projectId as string | undefined;
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await taskService.getAllTasks(projectId, COMPANY_ID, userId, userRole, options, await buildServiceScope(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getTaskById: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.sub!;
    const userRole = req.user?.role!;
    const task = await taskService.getTaskById(req.params.id as string, COMPANY_ID, userId, userRole, await buildServiceScope(req));
    res.json({ data: task });
  } catch (error) {
    next(error);
  }
};

export const createTask: RequestHandler = async (req, res, next) => {
  try {
    const task = await taskService.createTask(req.body, COMPANY_ID, await buildServiceScope(req));
    res.status(201).json({ data: task });
  } catch (error) {
    next(error);
  }
};

export const updateTask: RequestHandler = async (req, res, next) => {
  try {
    const task = await taskService.updateTask(req.params.id as string, req.body, COMPANY_ID, await buildServiceScope(req));
    res.json({ data: task });
  } catch (error) {
    next(error);
  }
};

export const deleteTask: RequestHandler = async (req, res, next) => {
  try {
    await taskService.deleteTask(req.params.id as string, COMPANY_ID, await buildServiceScope(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
