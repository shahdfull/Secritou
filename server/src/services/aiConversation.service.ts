import { aiConversationRepository } from "../repositories/aiConversation.repository.js";
import { HttpError } from "../utils/httpError.js";
import { callOllama } from "./llm.client.js";

const SYSTEM_PROMPT = `Tu es l'assistant IA de Secritou, une plateforme CRM pour agences digitales.
Tu aides les administrateurs et managers à gérer leurs leads, clients, projets, tâches et freelancers.
Réponds en français de manière concise et professionnelle.
Si tu ne connais pas une information spécifique, indique-le honnêtement.`;

function toChatRole(role: string): "user" | "assistant" | "system" {
  return role.toUpperCase() === "ASSISTANT" ? "assistant" : role.toUpperCase() === "SYSTEM" ? "system" : "user";
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

  async create(userId: string, firstMessage: string, persona?: string) {
    // Auto-generate title from the first message (truncate to 60 chars)
    const title = firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "…" : "");

    // SEC-035: call the LLM before persisting anything — a failed/timed-out call must leave no
    // trace (conversation or USER message) rather than an orphaned USER message with no reply,
    // which a naive client retry would otherwise duplicate on every failed attempt.
    const history = [{ role: "user", content: firstMessage }];
    const reply = await callOllama(history, SYSTEM_PROMPT);

    const conv = await aiConversationRepository.create(userId, title, persona);
    await aiConversationRepository.addMessage(conv.id, "USER", firstMessage);
    const assistantMsg = await aiConversationRepository.addMessage(conv.id, "ASSISTANT", reply);

    return { conversation: conv, reply: assistantMsg };
  },

  async addMessage(id: string, userId: string, content: string) {
    const conv = await aiConversationRepository.findById(id, userId);
    if (!conv) throw new HttpError(404, "Conversation not found");

    // SEC-035: call the LLM before persisting the USER message — same rationale as create()
    // above. History is built from what's already in DB plus the new message in memory, so no
    // write is needed before the call.
    const recentMessages = conv.messages.slice(-20);
    const history = [
      ...recentMessages.map((m) => ({ role: toChatRole(m.role), content: m.content })),
      { role: "user", content },
    ];
    const reply = await callOllama(history, SYSTEM_PROMPT);

    await aiConversationRepository.addMessage(conv.id, "USER", content);
    const assistantMsg = await aiConversationRepository.addMessage(conv.id, "ASSISTANT", reply);

    return { reply: assistantMsg };
  },

  async delete(id: string, userId: string) {
    const conv = await aiConversationRepository.findById(id, userId);
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
