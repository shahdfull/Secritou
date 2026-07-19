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
    // assigneeId/overdue (SEC-056): kept out of ListQueryOptions (shared across every list
    // endpoint — clients, invoices, etc.) since they're specific to tasks, mirroring how
    // projectId is already threaded through as its own argument rather than folded into options.
    const assigneeId = typeof req.query.assigneeId === "string" && req.query.assigneeId.trim() ? req.query.assigneeId.trim() : undefined;
    const overdue = req.query.overdue === "true";
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await taskService.getAllTasks(projectId, userId, userRole, options, await buildServiceScope(req), { assigneeId, overdue });
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
    // req.query is genuinely { startDate: Date; endDate: Date } here, not a lie about raw
    // strings — validate(getFreelancerAvailabilitySchema) on this route (task.routes.ts)
    // already parsed and .transform()'d them into real Date objects, and reassigned req.query
    // in place (validate.middleware.ts). This cast only holds as long as that middleware stays
    // mounted on this route — removing it would silently make startDate/endDate raw strings
    // again without any type error here.
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
