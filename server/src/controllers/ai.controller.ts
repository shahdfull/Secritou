import type { RequestHandler } from "express";
import { HttpError } from "../utils/httpError.js";
import { agentOrchestratorService } from "../services/agentOrchestrator.service.js";
import { callOllama } from "../services/llm.client.js";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `Tu es l'assistant IA de Secritou, une plateforme CRM pour agences digitales.
Tu aides les administrateurs et managers à gérer leurs leads, clients, projets, tâches et freelancers.
Réponds en français de manière concise et professionnelle.
Si tu ne connais pas une information spécifique, indique-le honnêtement.`;

export const chat: RequestHandler = async (req, res, next) => {
  try {
    const { message, history = [] } = req.body as {
      message: string;
      history?: ChatMessage[];
    };

    if (!message?.trim()) {
      throw new HttpError(400, "Message is required");
    }

    const messages = [
      ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const reply = await callOllama(messages, SYSTEM_PROMPT);

    res.json({ data: { message: reply } });
  } catch (error) {
    next(error);
  }
};

export const generateBrief: RequestHandler = async (req, res, next) => {
  try {
    const { context } = req.body as {
      context: Record<string, unknown>;
    };

    const result = await agentOrchestratorService.executeAgent(
      "brief-generator",
      context,
      req.user!.sub,
      req.user!.role
    );

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const generateTasks: RequestHandler = async (req, res, next) => {
  try {
    const { context } = req.body as {
      context: Record<string, unknown>;
    };

    const result = await agentOrchestratorService.executeAgent(
      "task-planner",
      context,
      req.user!.sub,
      req.user!.role
    );

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};
