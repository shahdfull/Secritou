// Controller for Comments - HTTP request handlers
import type { RequestHandler } from "express";
import { commentService } from "../services/comment.service.js";
import { taskRepository } from "../repositories/task.repository.js";
import { HttpError } from "../utils/httpError.js";
import { buildServiceScope } from "../utils/serviceScope.js";

export const getCommentsByTaskId: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const userRole = req.user!.role;
    const taskId = req.params.taskId as string;
    const scope = await buildServiceScope(req);

    const hasAccess = await taskRepository.existsInCompany(taskId, userId, userRole, scope.userServiceId);
    if (!hasAccess) {
      throw new HttpError(404, "Task not found");
    }

    const comments = await commentService.getCommentsByTaskId(taskId);
    res.json({ data: comments });
  } catch (error) {
    next(error);
  }
};

export const createComment: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const userRole = req.user!.role;
    const taskId = req.params.taskId as string;
    const { content } = req.body;
    const scope = await buildServiceScope(req);

    const hasAccess = await taskRepository.existsInCompany(taskId, userId, userRole, scope.userServiceId);
    if (!hasAccess) {
      throw new HttpError(404, "Task not found");
    }

    const comment = await commentService.createComment({
      content,
      taskId,
      authorId: userId,
    });
    res.status(201).json({ data: comment });
  } catch (error) {
    next(error);
  }
};
