import type { RequestHandler } from "express";
import { aiConversationService } from "../services/aiConversation.service.js";

export const listConversations: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.sub!;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
    const result = await aiConversationService.list(userId, page, pageSize);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getConversation: RequestHandler = async (req, res, next) => {
  try {
    const conv = await aiConversationService.getById(
      req.params.id as string,
      req.user!.sub!
    );
    res.json({ data: conv });
  } catch (error) {
    next(error);
  }
};

export const createConversation: RequestHandler = async (req, res, next) => {
  try {
    const { message } = req.body as { message: string };
    const result = await aiConversationService.create(
      req.user!.sub!,
      message
    );
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const addMessage: RequestHandler = async (req, res, next) => {
  try {
    const { message } = req.body as { message: string };
    const result = await aiConversationService.addMessage(
      req.params.id as string,
      req.user!.sub!,
      message
    );
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const deleteConversation: RequestHandler = async (req, res, next) => {
  try {
    await aiConversationService.delete(
      req.params.id as string,
      req.user!.sub!
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const importFromLocalStorage: RequestHandler = async (req, res, next) => {
  try {
    const { messages } = req.body as {
      messages: { role: "user" | "assistant"; content: string }[];
    };
    const conv = await aiConversationService.importFromLocalStorage(
      req.user!.sub!,
      messages ?? []
    );
    res.status(201).json({ data: conv });
  } catch (error) {
    next(error);
  }
};
