import { aiConversationRepository } from "../repositories/aiConversation.repository.js";
import { HttpError } from "../utils/httpError.js";
import { callOllamaWithTools, type OllamaChatMessage } from "./llm.client.js";
import { AI_TOOL_DEFINITIONS, isKnownAiTool, runAiTool, type AiToolCallerContext } from "./aiTools.js";

// SEC-059: the assistant now has real read access to Lead/Client/Project/Task/Freelancer via
// Ollama tool calling (aiTools.ts) — the system prompt describes exactly that capability, not the
// stale "je gère vos leads/clients/..." claim that used to promise this with no code behind it.
const SYSTEM_PROMPT = `Tu es l'assistant IA de Secritou, une plateforme CRM pour agences digitales.
Tu peux consulter en lecture seule les leads, clients, projets, tâches et freelancers de
l'utilisateur courant via les outils mis à ta disposition (getLeads, getClients, getProjects,
getTasks, getFreelancers) — utilise-les pour répondre à une question sur des données réelles du
CRM plutôt que de deviner. Tu ne peux rien créer, modifier ni supprimer.
Réponds en français de manière concise et professionnelle.
Si tu ne connais pas une information spécifique et qu'aucun outil ne peut te la fournir, indique-le
honnêtement.`;

function toChatRole(role: string): "user" | "assistant" | "system" {
  return role.toUpperCase() === "ASSISTANT" ? "assistant" : role.toUpperCase() === "SYSTEM" ? "system" : "user";
}

// A model that keeps calling tools forever (bad arguments, a tool result it can't parse) must not
// hang the request indefinitely — bounded the same way callAgentWithRetry used to bound retries
// before it was removed (SEC-042/SEC-040), but here bounding tool round-trips, not error retries.
const MAX_TOOL_ROUNDTRIPS = 4;

// Runs the tool-calling loop: calls Ollama, executes any tool_calls the model requests (scoped to
// the calling user via aiTools.ts, which reuses the exact same services/scoping as the REST
// endpoints), feeds the results back, and repeats until the model replies with real content or the
// round-trip cap is hit. Returns the final assistant content only — tool exchanges themselves are
// never persisted as AiMessage rows (SEC-059: keeps the doctrine "AiMessage is chat history",
// not an execution log).
async function runConversationTurn(
  history: OllamaChatMessage[],
  callerContext: AiToolCallerContext
): Promise<string> {
  const messages: OllamaChatMessage[] = [...history];

  for (let roundTrip = 0; roundTrip < MAX_TOOL_ROUNDTRIPS; roundTrip++) {
    const response = await callOllamaWithTools(messages, AI_TOOL_DEFINITIONS, SYSTEM_PROMPT);

    if (!response.tool_calls || response.tool_calls.length === 0) {
      return response.content;
    }

    messages.push(response);
    for (const call of response.tool_calls) {
      const name = call.function.name;
      // An unknown tool name (a hallucinated call) never reaches Prisma — reported back to the
      // model as a tool error message instead of thrown, so the model can recover in its next
      // turn rather than the whole request failing on a model mistake.
      const result = isKnownAiTool(name)
        ? await runAiTool(name, call.function.arguments, callerContext)
        : { error: `Unknown tool: ${name}` };
      messages.push({ role: "tool", content: JSON.stringify(result) });
    }
  }

  throw new HttpError(502, "Ollama provider did not produce a final reply after repeated tool calls");
}

export const aiConversationService = {
  async list(userId: string, page: number, pageSize: number) {
    return aiConversationRepository.findAll(userId, page, pageSize);
  },

  async getById(id: string, userId: string) {
    const conv = await aiConversationRepository.findById(id, userId);
    if (!conv) throw new HttpError(404, "Conversation not found");
    return conv;
  },

  async create(userId: string, firstMessage: string, callerContext: AiToolCallerContext, persona?: string) {
    // Auto-generate title from the first message (truncate to 60 chars)
    const title = firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "…" : "");

    // SEC-035: call the LLM before persisting anything — a failed/timed-out call must leave no
    // trace (conversation or USER message) rather than an orphaned USER message with no reply,
    // which a naive client retry would otherwise duplicate on every failed attempt.
    const history: OllamaChatMessage[] = [{ role: "user", content: firstMessage }];
    const reply = await runConversationTurn(history, callerContext);

    const conv = await aiConversationRepository.create(userId, title, persona);
    await aiConversationRepository.addMessage(conv.id, "USER", firstMessage);
    const assistantMsg = await aiConversationRepository.addMessage(conv.id, "ASSISTANT", reply);

    return { conversation: conv, reply: assistantMsg };
  },

  async addMessage(id: string, userId: string, content: string, callerContext: AiToolCallerContext) {
    // SEC-058: pre-read immediately followed by a write below (addMessage) — must use the write
    // client, not prismaRead, per the same doctrine already applied to gdprService (SEC-037).
    const conv = await aiConversationRepository.findByIdForWrite(id, userId);
    if (!conv) throw new HttpError(404, "Conversation not found");

    // SEC-035: call the LLM before persisting the USER message — same rationale as create()
    // above. History is built from what's already in DB plus the new message in memory, so no
    // write is needed before the call.
    const recentMessages = conv.messages.slice(-20);
    const history: OllamaChatMessage[] = [
      ...recentMessages.map((m) => ({ role: toChatRole(m.role), content: m.content })),
      { role: "user", content },
    ];
    const reply = await runConversationTurn(history, callerContext);

    await aiConversationRepository.addMessage(conv.id, "USER", content);
    const assistantMsg = await aiConversationRepository.addMessage(conv.id, "ASSISTANT", reply);

    return { reply: assistantMsg };
  },

  async delete(id: string, userId: string) {
    // SEC-058: pre-read immediately followed by a write below (delete) — same doctrine as above.
    const conv = await aiConversationRepository.findByIdForWrite(id, userId);
    if (!conv) throw new HttpError(404, "Conversation not found");
    await aiConversationRepository.delete(id, userId);
  },

  async importFromLocalStorage(
    userId: string,
    messages: { role: "user" | "assistant"; content: string }[]
  ) {
    if (!messages.length) return null;
    const conv = await aiConversationRepository.create(userId, "Historique importé");
    for (const msg of messages) {
      await aiConversationRepository.addMessage(
        conv.id,
        msg.role.toUpperCase() === "ASSISTANT" ? "ASSISTANT" : "USER",
        msg.content
      );
    }
    return conv;
  },
};
