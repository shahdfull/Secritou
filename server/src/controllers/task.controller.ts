// Controller for Tasks - HTTP request handlers
import type { RequestHandler } from "express";
import { taskService } from "../services/task.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { buildServiceScope } from "../utils/serviceScope.js";

export const getAllTasks: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const userRole = req.user!.role;
    const projectId = req.query.projectId as string | undefined;
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await taskService.getAllTasks(projectId, userId, userRole, options, await buildServiceScope(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getTaskById: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const userRole = req.user!.role;
    const task = await taskService.getTaskById(req.params.id as string, userId, userRole, await buildServiceScope(req));
    res.json({ data: task });
  } catch (error) {
    next(error);
  }
};

export const createTask: RequestHandler = async (req, res, next) => {
  try {
    const task = await taskService.createTask(req.body, await buildServiceScope(req));
    res.status(201).json({ data: task });
  } catch (error) {
    next(error);
  }
};

export const updateTask: RequestHandler = async (req, res, next) => {
  try {
    const task = await taskService.updateTask(req.params.id as string, req.body, await buildServiceScope(req));
    res.json({ data: task });
  } catch (error) {
    next(error);
  }
};

export const getFreelancerAvailability: RequestHandler = async (req, res, next) => {
  try {
    const { freelancerId, startDate, endDate, excludeTaskId } = req.query as unknown as {
      freelancerId: string;
      startDate: Date;
      endDate: Date;
      excludeTaskId?: string;
    };
    const conflicts = await taskService.getFreelancerAvailability(freelancerId, startDate, endDate, excludeTaskId);
    res.json({ data: { conflicts } });
  } catch (error) {
    next(error);
  }
};

export const deleteTask: RequestHandler = async (req, res, next) => {
  try {
    await taskService.deleteTask(req.params.id as string, await buildServiceScope(req), req.user?.sub, req.user?.role);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
