
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
  tools?: readonly OllamaToolDefinition[],
  signal?: AbortSignal
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
    // callOllamaWithTools always passes one shared AbortSignal for the whole tool-calling loop
    // (see its own doc comment) — this per-call fallback only applies if a future caller omits it.
    signal: signal ?? AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new HttpError(502, `Ollama provider error: ${error}`);
  }

  const data = (await response.json()) as { message: OllamaChatMessage };
  return data.message;
}

/**
 * Calls Ollama's chat API with tool definitions attached (SEC-059). An empty `content` is valid:
 * a model choosing to call a tool instead of answering directly returns `tool_calls` with no
 * content — the caller (aiConversation.service.ts) is responsible for executing those calls,
 * appending their results as "tool" role messages, and calling this again until the model replies
 * with real content.
 *
 * `signal` is meant to be a single AbortSignal shared across every call in a tool-calling loop
 * (created once per turn by the caller, not per call) — each individual fetch's own 120s timeout
 * bounds one Ollama round trip, but says nothing about the total wall-clock time of a turn that
 * makes several. Without a shared deadline, MAX_TOOL_ROUNDTRIPS round trips at up to 120s each can
 * legitimately take minutes, long after the browser request has given up, while still holding an
 * Express connection and an Ollama call slot open.
 */
export async function callOllamaWithTools(
  messages: (OllamaChatMessage | { role: string; content: string })[],
  tools: readonly OllamaToolDefinition[],
  systemPrompt?: string,
  signal?: AbortSignal
): Promise<OllamaChatMessage> {
  const allMessages = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const message = await postChat(allMessages, tools, signal);

  // A response with neither content nor a tool call is the same "silent empty reply" SEC-039
  // already rejects for the no-tools path — reject explicitly rather than persisting/returning an
  // empty ASSISTANT message indistinguishable from a genuine (if terse) one.
  if (!message.content && (!message.tool_calls || message.tool_calls.length === 0)) {
    throw new HttpError(502, "Ollama provider returned an empty response");
  }

  return message;
}

