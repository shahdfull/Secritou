
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

/**
 * Calls Ollama's chat API.
 * @param messages - Array of messages (role: "system" | "user" | "assistant", content: string)
 * @param systemPrompt - Optional system prompt to prepend
 * @returns The assistant's response as a string
 */
export async function callOllama(
  messages: { role: string; content: string }[],
  systemPrompt?: string
): Promise<string> {
  const allMessages = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const response = await fetch(`${env.OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OLLAMA_MODEL,
      messages: allMessages,
      stream: false,
      options: {
        temperature: 0.7,
      },
    }),
    signal: AbortSignal.timeout(120000), // 2 minutes timeout
  });

  if (!response.ok) {
    const error = await response.text();
    throw new HttpError(502, `Ollama provider error: ${error}`);
  }

  const data = (await response.json()) as {
    message: { content: string };
  };

  return (
    data.message?.content ?? "Désolé, je n'ai pas pu générer de réponse."
  );
}

