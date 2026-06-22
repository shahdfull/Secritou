import type { RequestHandler } from "express";
import { customQuestionService } from "../services/customQuestion.service.js";
import type { CustomQuestionStatus } from "@prisma/client";
import { COMPANY_ID } from "../config/constants.js";

// POST /api/custom-questions — any authenticated user
export const createQuestion: RequestHandler = async (req, res, next) => {
  try {
    const result = await customQuestionService.createQuestion(req.user!.sub, req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/custom-questions/my — the caller's own questions
export const getMyQuestions: RequestHandler = async (req, res, next) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const result = await customQuestionService.getMyQuestions(req.user!.sub, page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// GET /api/custom-questions/:id — owner or staff
export const getQuestionById: RequestHandler = async (req, res, next) => {
  try {
    const result = await customQuestionService.getQuestionById(
      req.params.id as string,
      req.user!.sub,
      req.user!.role
    );
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/custom-questions — staff only
export const getAllQuestions: RequestHandler = async (req, res, next) => {
  try {
    const status = req.query.status as CustomQuestionStatus | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const result = await customQuestionService.getAllQuestions(
      { status },
      page,
      limit
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// POST /api/custom-questions/:id/messages — owner or staff
export const addMessage: RequestHandler = async (req, res, next) => {
  try {
    const { content } = req.body as { content: string };
    const result = await customQuestionService.addMessage(
      req.params.id as string,
      req.user!.sub,
      req.user!.role,
      content
    );
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/custom-questions/:id/status — staff only
export const updateQuestionStatus: RequestHandler = async (req, res, next) => {
  try {
    const { status } = req.body as { status: CustomQuestionStatus };
    const result = await customQuestionService.updateStatus(req.params.id as string, status);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};
