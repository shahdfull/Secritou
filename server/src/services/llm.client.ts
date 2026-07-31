
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

export interface OllamaToolCall {
  function: { name: string; arguments: unknown };
}

export interface OllamaChatMessage {
  role: string;
  content: string;
  tool_calls?: OllamaToolCall[];
}

// OpenAI-style function tool declaration — matches AI_TOOL_DEFINITIONS in aiTools.ts.
export interface OllamaToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

async function postChat(
  messages: { role: string; content: string; tool_calls?: OllamaToolCall[] }[],
  tools?: readonly OllamaToolDefinition[]
): Promise<OllamaChatMessage> {
  const response = await fetch(`${env.OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OLLAMA_MODEL,
      messages,
      stream: false,
      ...(tools && tools.length > 0 ? { tools } : {}),
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

  const data = (await response.json()) as { message: OllamaChatMessage };
  return data.message;
}

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

  const message = await postChat(allMessages);

  // SEC-039: a 200 with an empty/missing content used to fall back to a fixed placeholder
  // string, silently persisted as a real ASSISTANT message (aiConversationRepository.addMessage)
  // indistinguishable from a genuine model reply. Reject explicitly instead.
  if (!message.content) {
    throw new HttpError(502, "Ollama provider returned an empty response");
  }

  return message.content;
}

/**
 * Calls Ollama's chat API with tool definitions attached (SEC-059). Unlike callOllama, an empty
 * `content` is valid here: a model choosing to call a tool instead of answering directly returns
 * `tool_calls` with no content — the caller (aiConversation.service.ts) is responsible for
 * executing those calls, appending their results as "tool" role messages, and calling this again
 * until the model replies with real content.
 */
export async function callOllamaWithTools(
  messages: (OllamaChatMessage | { role: string; content: string })[],
  tools: readonly OllamaToolDefinition[],
  systemPrompt?: string
): Promise<OllamaChatMessage> {
  const allMessages = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const message = await postChat(allMessages, tools);

  // A response with neither content nor a tool call is the same "silent empty reply" SEC-039
  // already rejects for the no-tools path — reject explicitly rather than persisting/returning an
  // empty ASSISTANT message indistinguishable from a genuine (if terse) one.
  if (!message.content && (!message.tool_calls || message.tool_calls.length === 0)) {
    throw new HttpError(502, "Ollama provider returned an empty response");
  }

  return message;
}

