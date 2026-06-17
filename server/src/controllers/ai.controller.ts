import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `Tu es l'assistant IA de Secritou, une plateforme CRM pour agences digitales.
Tu aides les administrateurs et managers à gérer leurs leads, clients, projets, tâches, freelancers et missions.
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

    if (!env.OPENAI_API_KEY) {
      throw new HttpError(503, "AI service is not configured");
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new HttpError(502, `AI provider error: ${error}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };

    const reply = data.choices[0]?.message?.content ?? "Désolé, je n'ai pas pu générer de réponse.";

    res.json({ data: { message: reply } });
  } catch (error) {
    next(error);
  }
};
