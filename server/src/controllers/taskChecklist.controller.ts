// Controller for TaskChecklistItem - HTTP request handlers
import type { RequestHandler } from "express";
import { taskChecklistService } from "../services/taskChecklist.service.js";
import { taskRepository } from "../repositories/task.repository.js";
import { HttpError } from "../utils/httpError.js";
import { buildServiceScope } from "../utils/serviceScope.js";

async function assertTaskAccess(req: Parameters<RequestHandler>[0], taskId: string) {
  const userId = req.user!.sub;
  const userRole = req.user!.role;
  const scope = await buildServiceScope(req);
  const hasAccess = await taskRepository.existsInCompany(taskId, userId, userRole, scope.userServiceId);
  if (!hasAccess) throw new HttpError(404, "Task not found");
}

export const getChecklistItems: RequestHandler = async (req, res, next) => {
  try {
    const taskId = req.params.taskId as string;
    await assertTaskAccess(req, taskId);
    const items = await taskChecklistService.getByTaskId(taskId);
    res.json({ data: items });
  } catch (error) {
    next(error);
  }
};

export const createChecklistItem: RequestHandler = async (req, res, next) => {
  try {
    const taskId = req.params.taskId as string;
    await assertTaskAccess(req, taskId);
    const { title } = req.body as { title: string };
    const item = await taskChecklistService.createItem(taskId, title);
    res.status(201).json({ data: item });
  } catch (error) {
    next(error);
  }
};

export const updateChecklistItem: RequestHandler = async (req, res, next) => {
  try {
    const taskId = req.params.taskId as string;
    const itemId = req.params.itemId as string;
    await assertTaskAccess(req, taskId);
    const { title, done } = req.body as { title?: string; done?: boolean };
    const item = await taskChecklistService.updateItem(taskId, itemId, { title, done });
    res.json({ data: item });
  } catch (error) {
    next(error);
  }
};

export const deleteChecklistItem: RequestHandler = async (req, res, next) => {
  try {
    const taskId = req.params.taskId as string;
    const itemId = req.params.itemId as string;
    await assertTaskAccess(req, taskId);
    await taskChecklistService.deleteItem(taskId, itemId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
